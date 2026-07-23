import { isNil } from "lodash";

import {
  MessageUpsertType,
  proto,
  WAMessage,
  WAMessageUpdate,
  WASocket,
} from "baileys";
import moment from "moment";

import { debounce } from "../../shared/helpers/Debounce";
import formatBody from "../../shared/helpers/Mustache";
import { cacheLayer } from "../../libs/cache";
import { logger } from "../../utils/logger";

import { CompaniesService } from "../companies/CompaniesService";
import { getContactJid } from "../contacts/getContactJid";
import Contact from "../contacts/models/Contact";
import { MessagesRepository } from "../messages/MessagesRepository";
import { QueuesRepository } from "../queues/QueuesRepository";
import { TicketsRepository } from "../tickets/TicketsRepository";
// Singleton do domínio settings (leaf) — uso em tempo de chamada.
import { settingsService } from "../settings/SettingsService";
// Ciclo TicketsService ⇄ módulo da sessão: usar o singleton SEMPRE dentro do
// corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { ticketsService } from "../tickets/TicketsService";
// Idem para o WhatsappService.
import { whatsappService } from "../whatsapp/WhatsappService";

// Ciclo queue-integrations → WhatsappService → módulo da sessão: usar o
// singleton SEMPRE dentro do corpo dos métodos (binding CommonJS lazy).
import { queueIntegrationsService } from "../queue-integrations/QueueIntegrationsService";

// Colaboradores do módulo referenciados só em tempo de chamada — o grafo
// tickets ⇄ whatsapp-session é cíclico e capturas no construtor quebrariam a
// inicialização CommonJS (mesma convenção da B4).
import { ackHandler } from "./AckHandler";
import { campaignHooks } from "./CampaignHooks";
import { chatbotFlowService } from "./ChatbotFlowService";
import { contactVerifier } from "./ContactVerifier";
import { lastContactNotifier } from "./LastContactNotifier";
import { MessageParser } from "./MessageParser";
import { messagePersistenceService } from "./MessagePersistenceService";
import { ratingService } from "./RatingService";
import { Session } from "./types";

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

/**
 * Orquestrador do fluxo de mensagens do wbot (antigo `wbotMessageListener`):
 * registra os handlers de `messages.upsert`/`messages.update` e conduz cada
 * mensagem pelo pipeline (parse → contato → last-contact → ticket →
 * persistência → expediente → avaliação → integrações → chatbot). Caminho
 * mais quente do sistema — lógica preservada linha a linha.
 */
export class MessageListener {
  constructor(
    // Domínio de empresas migrado (B3): a checagem de expediente foi absorvida
    // pelo CompaniesService (antigo VerifyCurrentSchedule).
    private readonly companiesService = new CompaniesService(),
    private readonly messagesRepository = new MessagesRepository(),
    private readonly queuesRepository = new QueuesRepository(),
    private readonly ticketsRepository = new TicketsRepository()
  ) {}

  public async handleMessage(
    msg: WAMessage,
    wbot: Session,
    companyId: number
  ): Promise<void> {
    if (!MessageParser.isValidMsg(msg)) {
      return;
    }
    try {
      let groupContact: Contact | undefined;

      const isGroup = msg.key.remoteJid?.endsWith("@g.us");

      const msgIsGroupBlock = await settingsService.getByKey({
        companyId,
        key: "CheckMsgIsGroup",
      });

      const bodyMessage = MessageParser.getBodyMessage(msg);
      const msgType = MessageParser.getTypeMessage(msg);

      const hasMedia =
        msg.message?.audioMessage ||
        msg.message?.imageMessage ||
        msg.message?.videoMessage ||
        msg.message?.documentMessage ||
        msg.message?.documentWithCaptionMessage ||
        msg.message.stickerMessage;
      if (msg.key.fromMe) {
        if (/\u200e/.test(bodyMessage)) {
          return;
        }

        if (
          !hasMedia &&
          msgType !== "conversation" &&
          msgType !== "extendedTextMessage" &&
          msgType !== "vcard" &&
          msgType !== "editedMessage"
        ) {
          return;
        }
      }

      if (msgIsGroupBlock?.value === "enabled" && isGroup) {
        return;
      }

      if (isGroup) {
        groupContact = await contactVerifier.verifyGroup(msg, wbot, companyId);
      }

      const whatsapp = await whatsappService.show(wbot.id!, companyId);
      const contact = await contactVerifier.verifyContact(msg, wbot, companyId);

      // Registra "último contato" no sistema de inadimplência apenas quando o
      // CLIENTE nos envia uma mensagem em uma conversa individual (mensagens que
      // NÓS enviamos não contam como contato do cliente). Fire-and-forget: a
      // chamada trata os próprios erros e nunca bloqueia/interrompe o
      // processamento da mensagem.
      if (!msg.key.fromMe && !isGroup) {
        lastContactNotifier.notify(contact.number).catch(() => {
          /* erros já são logados internamente */
        });
      }

      let unreadMessages = 0;

      const REDIS_KEY = `contacts:${(groupContact || contact).id}:unreads`;

      if (msg.key.fromMe) {
        await cacheLayer.set(REDIS_KEY, "0");
      } else {
        const unreads = await cacheLayer.get(REDIS_KEY);
        unreadMessages = +unreads + 1;
        await cacheLayer.set(
          REDIS_KEY,
          `${unreadMessages}`
        );
      }

      const lastMessage = await this.messagesRepository.findLastByContactAndCompany(
        contact.id,
        companyId
      );

      if (unreadMessages === 0 && whatsapp.complationMessage && formatBody(whatsapp.complationMessage, contact).trim().toLowerCase() === lastMessage?.body?.trim().toLowerCase()) {
        return;
      }

      const ticket = await ticketsService.findOrCreate(contact, wbot.id!, unreadMessages, companyId, groupContact);

      // voltar para o menu inicial
      if (bodyMessage == "#") {
        await this.ticketsRepository.updateInstance(ticket, {
          queueOptionId: null,
          chatbot: false,
          queueId: null,
        });
        await chatbotFlowService.verifyQueue(wbot, msg, ticket, ticket.contact);
        return;
      }

      const ticketTraking = await ticketsService.findOrCreateTraking({
        ticketId: ticket.id,
        companyId,
        whatsappId: whatsapp?.id
      });

      // Atualiza o ticket se a ultima mensagem foi enviada por mim, para que possa ser finalizado.
      try {
        await this.ticketsRepository.updateInstance(ticket, {
          fromMe: msg.key.fromMe,
        });
      } catch (e) {
        logger.error(e);
      }

      if (hasMedia) {
        await messagePersistenceService.verifyMediaMessage(msg, ticket, contact);
      } else {
        await messagePersistenceService.verifyMessage(msg, ticket, contact);
      }

      const currentSchedule = await this.companiesService.verifyCurrentSchedule(
        companyId
      );
      const scheduleType = await settingsService.getByKey({
        companyId,
        key: "scheduleType"
      });

      try {
        if (!msg.key.fromMe && scheduleType) {
          /**
           * Tratamento para envio de mensagem quando a empresa está fora do expediente
           */
          if (
            scheduleType.value === "company" &&
            !isNil(currentSchedule) &&
            (!currentSchedule || currentSchedule.inActivity === false)
          ) {
            const body = `\u200e ${whatsapp.outOfHoursMessage}`;

            const debouncedSentMessage = debounce(
              async () => {
                await wbot.sendMessage(getContactJid(ticket.contact),
                  {
                    text: body
                  }
                );
              },
              3000,
              ticket.id
            );
            debouncedSentMessage();
            return;
          }

          /**
           * Tratamento para envio de mensagem quando a fila está fora do expediente
           */
          if (scheduleType.value === "queue" && ticket.queueId !== null) {
            const queue = await this.queuesRepository.findById(ticket.queueId);

            if (chatbotFlowService.isOutsideQueueSchedule(queue)) {
              const body = `${queue.outOfHoursMessage}`;
              const debouncedSentMessage = debounce(
                async () => {
                  await wbot.sendMessage(getContactJid(ticket.contact), {
                    text: body
                  });
                },
                3000,
                ticket.id
              );
              debouncedSentMessage();
              return;
            }
          }
        }
      } catch (e) {
        logger.error(e);
      }

      try {
        if (!msg.key.fromMe) {
          if (ticketTraking !== null && ratingService.verifyRating(ticketTraking)) {
            const rate = parseFloat(bodyMessage);
            if (!Number.isNaN(rate)) {
              await ratingService.handleRating(rate, ticket, ticketTraking);
            }
            return;
          }
        }
      } catch (e) {
        logger.error(e);
      }

      //integraçao na conexao
      if (
        !msg.key.fromMe &&
        !ticket.isGroup &&
        !ticket.queue &&
        !ticket.user &&
        ticket.chatbot &&
        !isNil(whatsapp.integrationId) &&
        !ticket.useIntegration
      ) {
        const integrations = await queueIntegrationsService.show(whatsapp.integrationId, companyId);

        await chatbotFlowService.handleMessageIntegration(msg, wbot, integrations, ticket)

        return
      }

      if (
        !msg.key.fromMe &&
        !ticket.isGroup &&
        // !ticket.userId &&
        ticket.integrationId &&
        ticket.useIntegration &&
        ticket.queue
      ) {

        const integrations = await queueIntegrationsService.show(ticket.integrationId, companyId);

        await chatbotFlowService.handleMessageIntegration(msg, wbot, integrations, ticket)

      }

      if (
        !ticket.queue &&
        !ticket.isGroup &&
        !msg.key.fromMe &&
        !ticket.userId &&
        whatsapp.queues.length >= 1 &&
        !ticket.useIntegration
      ) {

        await chatbotFlowService.verifyQueue(wbot, msg, ticket, contact);

        if (ticketTraking.chatbotAt === null) {
          await this.ticketsRepository.updateTrakingInstance(ticketTraking, {
            chatbotAt: moment().toDate(),
          })
        }
      }

      const dontReadTheFirstQuestion = ticket.queue === null;

      await this.ticketsRepository.reload(ticket);

      try {
        /**
         * Fluxo fora do expediente: reavalia a fila do ticket depois do
         * verifyQueue (o ticket pode ter acabado de entrar em uma fila)
         */
        if (
          !msg.key.fromMe &&
          scheduleType?.value === "queue" &&
          ticket.queueId !== null
        ) {
          const queue = await this.queuesRepository.findById(ticket.queueId);

          if (chatbotFlowService.isOutsideQueueSchedule(queue)) {
            const body = queue.outOfHoursMessage;
            const debouncedSentMessage = debounce(
              async () => {
                await wbot.sendMessage(getContactJid(ticket.contact), {
                  text: body
                });
              },
              3000,
              ticket.id
            );
            debouncedSentMessage();
            return;
          }
        }
      } catch (e) {
        logger.error(e);
      }

      if (!whatsapp?.queues?.length && !ticket.userId && !isGroup && !msg.key.fromMe) {

        const lastMessage = await this.messagesRepository.findLastFromMeByTicket(
          ticket.id
        );

        if (lastMessage && lastMessage.body?.includes(whatsapp.greetingMessage)) {
          return;
        }

        if (whatsapp.greetingMessage) {
          const debouncedSentMessage = debounce(
            async () => {
              await wbot.sendMessage(getContactJid(ticket.contact), {
                text: whatsapp.greetingMessage
              });
            },
            1000,
            ticket.id
          );
          debouncedSentMessage();
          return;
        }

      }

      if (whatsapp.queues.length == 1 && ticket.queue) {
        if (ticket.chatbot && !msg.key.fromMe) {
          await chatbotFlowService.handleChartbot(ticket, msg, wbot);
        }
      }
      if (whatsapp.queues.length > 1 && ticket.queue) {
        if (ticket.chatbot && !msg.key.fromMe) {
          await chatbotFlowService.handleChartbot(ticket, msg, wbot, dontReadTheFirstQuestion);
        }
      }

    } catch (err) {
      logger.error(`Error handling whatsapp message: Err: ${err}`);
    }
  }

  public async register(wbot: Session, companyId: number): Promise<void> {
    try {
      wbot.ev.on("messages.upsert", async (messageUpsert: ImessageUpsert) => {
        const messages = messageUpsert.messages.filter(
          MessageParser.filterMessages
        ) as WAMessage[];

        // Processamento sequencial: preserva a ordem das mensagens do lote e
        // evita corrida no FindOrCreateTicketService (tickets duplicados para
        // duas mensagens rápidas de um contato novo)
        for (const message of messages) {
          const messageExists = await this.messagesRepository.countByIdAndCompany(
            message.key.id!,
            companyId
          );

          if (!messageExists) {
            await this.handleMessage(message, wbot, companyId);
            await campaignHooks.verifyRecentCampaign(message, companyId);
            await campaignHooks.verifyCampaignMessageAndCloseTicket(message, companyId);
          }
        }
      });

      wbot.ev.on("messages.update", (messageUpdate: WAMessageUpdate[]) => {
        if (messageUpdate.length === 0) return;
        messageUpdate.forEach(async (message: WAMessageUpdate) => {
          (wbot as WASocket)!.readMessages([message.key])

          ackHandler.handleMsgAck(message, message.update.status);
        });
      });

    } catch (error) {
      logger.error(`Error handling wbot message listener. Err: ${error}`);
    }
  }
}

export const messageListener = new MessageListener();
