import * as Sentry from "@sentry/node";
import { addSeconds, differenceInSeconds } from "date-fns";
import { isArray, isEmpty, isNil } from "lodash";
import moment from "moment";
import path from "path";

import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { logger } from "../../utils/logger";
// Instância Bull importada direto da infra (queues/connection) — o barrel
// src/queues.ts puxa o wiring dos processors e criaria ciclo com este módulo.
import { campaignQueue } from "../../queues/connection";
import { randomValue } from "../../queues/lib";

import { ContactListItemsRepository } from "../contact-lists/ContactListItemsRepository";
import ContactListItem from "../contact-lists/models/ContactListItem";
import { FilesService } from "../files/FilesService";
// Ciclo campaigns ⇄ whatsapp-session (o CampaignHooks do wbot lê este módulo):
// usar os singletons SEMPRE dentro do corpo dos métodos (binding CommonJS
// resolve lazy na chamada).
import { whatsappMessageSender } from "../whatsapp-session/WhatsappMessageSender";
// Idem para o WhatsappService (ciclo WhatsappService ⇄ módulo da sessão).
import { whatsappService } from "../whatsapp/WhatsappService";

import {
  CampaignDispatchSettings,
  CampaignVariable,
  DispatchCampaignJobData,
  PrepareContactJobData,
  ProcessCampaignJobData
} from "./dtos/CampaignJobData";
import Campaign from "./models/Campaign";
import {
  CampaignShippingWritableAttributes,
  CampaignsRepository
} from "./CampaignsRepository";

// Este módulo compila para dist/modules/campaigns/, então a pasta public do
// backend fica três níveis acima de __dirname (eram dois em dist/queues/).
const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

/**
 * Lógica de negócio dos 4 jobs Bull da CampaignQueue (antigo
 * queues/campaignJobs.ts — os ~13 helpers de módulo viraram métodos privados).
 * Comportamento VERBATIM: mesmos nomes de job, delays, uso de randomValue,
 * fluxo de confirmação e alternância de mensagens.
 *
 * O processor em jobs/CampaignProcessor.ts é só o wiring fino
 * (parse do job → método daqui).
 */
export class CampaignDispatchService {
  /**
   * Contador global de alternância de mensagens (antigo `ultima_msg`, estado
   * de módulo): compartilhado entre TODAS as campanhas, vida de processo —
   * semântica idêntica por ser estado da instância do singleton.
   */
  private lastMessageIndex = 0;

  constructor(
    private readonly repository = new CampaignsRepository(),
    private readonly contactListItemsRepository = new ContactListItemsRepository(),
    private readonly filesService = new FilesService(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  /** Job "VerifyCampaigns" (poller a cada 20s). */
  public async verifyCampaigns(): Promise<void> {
    /**
     * @todo
     * Implementar filtro de campanhas
     */
    const campaigns = await this.repository.findUpcomingScheduled();

    if (campaigns.length > 0)
      logger.info(`Campanhas encontradas: ${campaigns.length}`);

    for (const campaign of campaigns) {
      try {
        const now = moment();
        const scheduledAt = moment(campaign.scheduledAt);
        const delay = scheduledAt.diff(now, "milliseconds");
        logger.info(
          `Campanha enviada para a fila de processamento: Campanha=${campaign.id}, Delay Inicial=${delay}`
        );
        campaignQueue.add(
          "ProcessCampaign",
          {
            id: campaign.id,
            delay
          },
          {
            removeOnComplete: true
          }
        );
      } catch (err) {
        Sentry.captureException(err);
      }
    }
  }

  /** Job "ProcessCampaign": abre a campanha em jobs por contato. */
  public async processCampaign(data: ProcessCampaignJobData): Promise<void> {
    try {
      const { id } = data;
      const campaign = await this.repository.findByIdWithDispatchContext(id);
      const settings = await this.getSettings(campaign);
      if (!campaign) {
        return;
      }
      // Idempotency guard: the verify poller enqueues a ProcessCampaign every
      // 20s while status stays PROGRAMADA. Flip the status before enqueuing the
      // per-contact jobs so a second run (or a concurrent tick) is skipped and
      // contacts are not dispatched twice.
      if (campaign.status !== "PROGRAMADA") {
        return;
      }
      await this.repository.updateInstance(campaign, {
        status: "EM_ANDAMENTO"
      });
      const { contacts } = campaign.contactList;
      if (!isArray(contacts)) {
        return;
      }
      const contactData = contacts.map(contact => ({
        contactId: contact.id,
        campaignId: campaign.id,
        variables: settings.variables
      }));

      // longerIntervalAfter is a message count (compared to the loop index);
      // greaterInterval/messageInterval are in seconds (used by addSeconds and
      // converted to ms inside calculateDelay). None must be pre-multiplied.
      const longerIntervalAfter = settings.longerIntervalAfter;
      const greaterInterval = settings.greaterInterval;
      const messageInterval = settings.messageInterval;

      let baseDelay = campaign.scheduledAt;

      const queuePromises = [];
      for (let i = 0; i < contactData.length; i++) {
        baseDelay = addSeconds(
          baseDelay,
          i > longerIntervalAfter ? greaterInterval : messageInterval
        );

        const { contactId, campaignId, variables } = contactData[i];
        const delay = this.calculateDelay(
          i,
          baseDelay,
          longerIntervalAfter,
          greaterInterval,
          messageInterval
        );
        const queuePromise = campaignQueue.add(
          "PrepareContact",
          { contactId, campaignId, variables, delay },
          { removeOnComplete: true }
        );
        queuePromises.push(queuePromise);
        logger.info(
          `Registro enviado pra fila de disparo: Campanha=${campaign.id};Contato=${contacts[i].name};delay=${delay}`
        );
      }
      await Promise.all(queuePromises);
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  /** Job "PrepareContact": monta a remessa e agenda o disparo. */
  public async prepareContact(data: PrepareContactJobData): Promise<void> {
    try {
      const { contactId, campaignId, delay, variables } = data;
      const campaign = await this.repository.findByIdWithWhatsapp(campaignId);
      const contact = await this.contactListItemsRepository.findByIdForDispatch(
        contactId
      );

      const campaignShipping: CampaignShippingWritableAttributes = {};
      campaignShipping.number = contact.number;
      campaignShipping.contactId = contactId;
      campaignShipping.campaignId = campaignId;

      const messages = this.getCampaignValidMessages(campaign);
      if (messages.length) {
        // lastMessageIndex is shared across all campaigns, so clamp against
        // THIS campaign's message count to avoid indexing an undefined message.
        const radomIndex = this.lastMessageIndex % messages.length;
        this.lastMessageIndex++;
        if (this.lastMessageIndex >= messages.length) {
          this.lastMessageIndex = 0;
        }
        const message = this.getProcessedMessage(
          messages[radomIndex],
          variables,
          contact
        );
        campaignShipping.message = `\u200c ${message}`;
      }

      if (campaign.confirmation) {
        const confirmationMessages =
          this.getCampaignValidConfirmationMessages(campaign);
        if (confirmationMessages.length) {
          const radomIndex = randomValue(0, confirmationMessages.length);
          const message = this.getProcessedMessage(
            confirmationMessages[radomIndex],
            variables,
            contact
          );
          campaignShipping.confirmationMessage = `\u200c ${message}`;
        }
      }

      const [record, created] = await this.repository.findOrCreateShipping(
        {
          campaignId: campaignShipping.campaignId,
          contactId: campaignShipping.contactId
        },
        campaignShipping
      );

      if (
        !created &&
        record.deliveredAt === null &&
        record.confirmationRequestedAt === null
      ) {
        await this.repository.updateShippingInstance(record, campaignShipping);
      }

      if (
        record.deliveredAt === null &&
        record.confirmationRequestedAt === null
      ) {
        const nextJob = await campaignQueue.add(
          "DispatchCampaign",
          {
            campaignId: campaign.id,
            campaignShippingId: record.id,
            contactListItemId: contactId
          },
          {
            delay
          }
        );

        await this.repository.updateShippingInstance(record, {
          jobId: nextJob.id
        });
      }

      await this.verifyAndFinalizeCampaign(campaign);
    } catch (err) {
      Sentry.captureException(err);
      logger.error(
        `campaignQueue -> PrepareContact -> error: ${(err as Error).message}`
      );
    }
  }

  /** Job "DispatchCampaign": envia a mensagem (e/ou confirmação) pelo wbot. */
  public async dispatchCampaign(data: DispatchCampaignJobData): Promise<void> {
    try {
      const { campaignShippingId, campaignId } = data;
      const campaign = await this.repository.findByIdWithWhatsapp(campaignId);
      const wbot = await whatsappService.getWhatsappWbot(campaign.whatsapp);

      if (!wbot) {
        logger.error(
          `campaignQueue -> DispatchCampaign -> error: wbot not found`
        );
        return;
      }

      if (!campaign.whatsapp) {
        logger.error(
          `campaignQueue -> DispatchCampaign -> error: whatsapp not found`
        );
        return;
      }

      if (!wbot?.user?.id) {
        logger.error(
          `campaignQueue -> DispatchCampaign -> error: wbot user not found`
        );
        return;
      }

      logger.info(
        `Disparo de campanha solicitado: Campanha=${campaignId};Registro=${campaignShippingId}`
      );

      const campaignShipping =
        await this.repository.findShippingByIdWithContact(campaignShippingId);

      const chatId = `${campaignShipping.number}@s.whatsapp.net`;

      let body = campaignShipping.message;

      if (campaign.confirmation && campaignShipping.confirmation === null) {
        body = campaignShipping.confirmationMessage;
      }

      if (!isNil(campaign.fileListId)) {
        try {
          const files = await this.filesService.show(
            campaign.fileListId,
            campaign.companyId
          );
          const folder = path.resolve(
            publicFolder,
            "fileList",
            String(files.id)
          );
          for (const [, file] of files.options.entries()) {
            const options = await whatsappMessageSender.getMessageOptions(
              file.path,
              path.resolve(folder, file.path),
              file.name
            );
            await wbot.sendMessage(chatId, { ...options });
          }
        } catch (error) {
          logger.info(error);
        }
      }

      if (campaign.mediaPath) {
        const filePath = path.join(publicFolder, campaign.mediaPath);

        const options = await whatsappMessageSender.getMessageOptions(
          campaign.mediaName,
          filePath,
          body
        );
        // getMessageOptions retorna null em caso de falha
        if (options && Object.keys(options).length) {
          await wbot.sendMessage(chatId, { ...options });
        }
      } else {
        if (campaign.confirmation && campaignShipping.confirmation === null) {
          await wbot.sendMessage(chatId, {
            text: body
          });
          await this.repository.updateShippingInstance(campaignShipping, {
            confirmationRequestedAt: moment()
          });
        } else {
          await wbot.sendMessage(chatId, {
            text: body
          });
        }
      }
      await this.repository.updateShippingInstance(campaignShipping, {
        deliveredAt: moment()
      });

      await this.verifyAndFinalizeCampaign(campaign);

      // Emissão dupla preservada do original (verifyAndFinalizeCampaign já
      // emite o mesmo evento de update).
      this.emitCampaignUpdate(campaign);

      logger.info(
        `Campanha enviada para: Campanha=${campaignId};Contato=${campaignShipping.contact.name}`
      );
    } catch (err) {
      Sentry.captureException(err);
      logger.error((err as Error).message);
      // Era `console.log(err.stack)` — console.* é proibido no backend (doc 04 §6).
      logger.error((err as Error).stack);
    }
  }

  // ── Privados (antigos helpers de módulo do campaignJobs) ───────────────────

  /** Configurações de disparo da empresa, com defaults (antigo getSettings). */
  private async getSettings(
    campaign: Campaign
  ): Promise<CampaignDispatchSettings> {
    const settings = await this.repository.findSettingKeyValues(
      campaign.companyId
    );

    let messageInterval: number = 20;
    let longerIntervalAfter: number = 20;
    let greaterInterval: number = 60;
    let variables: CampaignVariable[] = [];

    settings.forEach(setting => {
      if (setting.key === "messageInterval") {
        messageInterval = JSON.parse(setting.value);
      }
      if (setting.key === "longerIntervalAfter") {
        longerIntervalAfter = JSON.parse(setting.value);
      }
      if (setting.key === "greaterInterval") {
        greaterInterval = JSON.parse(setting.value);
      }
      if (setting.key === "variables") {
        variables = JSON.parse(setting.value);
      }
    });

    return {
      messageInterval,
      longerIntervalAfter,
      greaterInterval,
      variables
    };
  }

  private getCampaignValidMessages(campaign: Campaign): string[] {
    const messages = [];

    if (!isEmpty(campaign.message1) && !isNil(campaign.message1)) {
      messages.push(campaign.message1);
    }

    if (!isEmpty(campaign.message2) && !isNil(campaign.message2)) {
      messages.push(campaign.message2);
    }

    if (!isEmpty(campaign.message3) && !isNil(campaign.message3)) {
      messages.push(campaign.message3);
    }

    if (!isEmpty(campaign.message4) && !isNil(campaign.message4)) {
      messages.push(campaign.message4);
    }

    if (!isEmpty(campaign.message5) && !isNil(campaign.message5)) {
      messages.push(campaign.message5);
    }

    return messages;
  }

  private getCampaignValidConfirmationMessages(campaign: Campaign): string[] {
    const messages = [];

    if (
      !isEmpty(campaign.confirmationMessage1) &&
      !isNil(campaign.confirmationMessage1)
    ) {
      messages.push(campaign.confirmationMessage1);
    }

    if (
      !isEmpty(campaign.confirmationMessage2) &&
      !isNil(campaign.confirmationMessage2)
    ) {
      messages.push(campaign.confirmationMessage2);
    }

    if (
      !isEmpty(campaign.confirmationMessage3) &&
      !isNil(campaign.confirmationMessage3)
    ) {
      messages.push(campaign.confirmationMessage3);
    }

    if (
      !isEmpty(campaign.confirmationMessage4) &&
      !isNil(campaign.confirmationMessage4)
    ) {
      messages.push(campaign.confirmationMessage4);
    }

    if (
      !isEmpty(campaign.confirmationMessage5) &&
      !isNil(campaign.confirmationMessage5)
    ) {
      messages.push(campaign.confirmationMessage5);
    }

    return messages;
  }

  private getProcessedMessage(
    msg: string,
    variables: CampaignVariable[],
    contact: ContactListItem
  ): string {
    let finalMessage = msg;

    if (finalMessage.includes("{nome}")) {
      finalMessage = finalMessage.replace(/{nome}/g, contact.name);
    }

    if (finalMessage.includes("{email}")) {
      finalMessage = finalMessage.replace(/{email}/g, contact.email);
    }

    if (finalMessage.includes("{numero}")) {
      finalMessage = finalMessage.replace(/{numero}/g, contact.number);
    }

    variables.forEach(variable => {
      if (finalMessage.includes(`{${variable.key}}`)) {
        const regex = new RegExp(`{${variable.key}}`, "g");
        finalMessage = finalMessage.replace(regex, variable.value);
      }
    });

    return finalMessage;
  }

  /** Finaliza a campanha quando todas as remessas foram entregues. */
  private async verifyAndFinalizeCampaign(campaign: Campaign): Promise<void> {
    const count1 = await this.contactListItemsRepository.countValidWhatsappByList(
      campaign.contactListId
    );
    const count2 = await this.repository.countDeliveredShipping(campaign.id);

    if (count1 === count2) {
      await this.repository.updateInstance(campaign, {
        status: "FINALIZADA",
        completedAt: moment()
      });
    }

    this.emitCampaignUpdate(campaign);
  }

  private calculateDelay(
    index: number,
    baseDelay: Date,
    longerIntervalAfter: number,
    greaterInterval: number,
    messageInterval: number
  ): number {
    const diffSeconds = differenceInSeconds(baseDelay, new Date());
    if (index > longerIntervalAfter) {
      return diffSeconds * 1000 + greaterInterval * 1000;
    }
    return diffSeconds * 1000 + messageInterval * 1000;
  }

  private emitCampaignUpdate(campaign: Campaign): void {
    this.realtime.emitToMainChannel(
      campaign.companyId,
      SocketEvents.companyCampaign(campaign.companyId),
      {
        action: "update",
        record: campaign
      }
    );
  }
}

// Singleton do domínio: o estado de alternância de mensagens vive na
// instância (vida de processo, como o estado de módulo anterior).
export const campaignDispatchService = new CampaignDispatchService();
