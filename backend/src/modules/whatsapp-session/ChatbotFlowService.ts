import { head, isNil } from "lodash";
import moment from "moment";
import path from "path";

import { proto, WAMessage } from "baileys";

import formatBody from "../../shared/helpers/Mustache";
import QueueIntegrations from "../queue-integrations/models/QueueIntegrations";
import { logger } from "../../utils/logger";

import { getContactJid } from "../contacts/getContactJid";
import Contact from "../contacts/models/Contact";
import { MessagesRepository } from "../messages/MessagesRepository";
import Queue from "../queues/models/Queue";
import QueueOption from "../queues/models/QueueOption";
import { QueueOptionsRepository } from "../queues/QueueOptionsRepository";
import { QueuesRepository } from "../queues/QueuesRepository";
// Ciclo SettingsService (leaf) — singleton usado em tempo de chamada por
// consistência com o restante do módulo.
import { settingsService } from "../settings/SettingsService";
import Ticket from "../tickets/models/Ticket";
import { TicketsRepository } from "../tickets/TicketsRepository";
// Ciclo TicketsService ⇄ módulo da sessão: usar o singleton SEMPRE dentro do
// corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { ticketsService } from "../tickets/TicketsService";
// Idem para o WhatsappService.
import { whatsappService } from "../whatsapp/WhatsappService";

// Ciclo queue-integrations → WhatsappService → módulo da sessão: usar o
// singleton SEMPRE dentro do corpo dos métodos (binding CommonJS lazy).
import { queueIntegrationsService } from "../queue-integrations/QueueIntegrationsService";

import { MessageParser } from "./MessageParser";
// Colaboradores internos do módulo referenciados só em tempo de chamada (o
// sender e a persistência participam do ciclo tickets ⇄ whatsapp-session).
import { messagePersistenceService } from "./MessagePersistenceService";
import { typebotSession } from "./TypebotSession";
import { whatsappMessageSender } from "./WhatsappMessageSender";
import { Session } from "./types";

const request = require("request");

/**
 * Fluxo de chatbot/atendimento automático do wbot (antigo `wbotChatbotFlow`):
 * menu de filas, árvore de opções (texto/botão/lista) e disparo de integrações
 * (n8n/webhook/typebot). Os sub-fluxos botText/botButton/botList do original
 * viram métodos privados — lógica verbatim, parametrizada pelo contexto que as
 * closures capturavam.
 */
export class ChatbotFlowService {
  constructor(
    private readonly messagesRepository = new MessagesRepository(),
    private readonly queuesRepository = new QueuesRepository(),
    private readonly queueOptionsRepository = new QueueOptionsRepository(),
    private readonly ticketsRepository = new TicketsRepository()
  ) {}

  /**
   * Verifica se a fila está fora do horário de expediente configurado para o
   * dia de hoje. Retorna false quando não há expediente configurado para hoje
   * ou quando a fila não tem mensagem de fora de expediente (comportamento
   * idêntico aos três blocos inline que esta função substituiu).
   */
  public isOutsideQueueSchedule(queue: Queue): boolean {
    if (isNil(queue.outOfHoursMessage) || queue.outOfHoursMessage === "") {
      return false;
    }

    const { schedules }: any = queue;
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return false;
    }

    const now = moment();
    const weekday = now.format("dddd").toLowerCase();
    const schedule = schedules.find(
      s =>
        s.weekdayEn === weekday &&
        s.startTime !== "" &&
        s.startTime !== null &&
        s.endTime !== "" &&
        s.endTime !== null
    );

    if (isNil(schedule)) {
      return false;
    }

    const startTime = moment(schedule.startTime, "HH:mm");
    const endTime = moment(schedule.endTime, "HH:mm");

    return now.isBefore(startTime) || now.isAfter(endTime);
  }

  public async handleMessageIntegration(
    msg: proto.IWebMessageInfo,
    wbot: Session,
    queueIntegration: QueueIntegrations,
    ticket: Ticket
  ): Promise<void> {
    const msgType = MessageParser.getTypeMessage(msg);

    if (queueIntegration.type === "n8n" || queueIntegration.type === "webhook") {
      if (!queueIntegration?.urlN8N) return;

      const options = {
        method: "POST",
        url: queueIntegration?.urlN8N,
        headers: {
          "Content-Type": "application/json"
        },
        json: msg
      };
      // `any` justificado (doc 04 §4): a lib `request` (require sem typings)
      // não dá tipo contextual ao callback.
      request(options, function (error: any, response: any) {
        if (error) {
          // Um throw aqui viraria exceção não capturada (callback assíncrono)
          logger.error(
            `Erro ao chamar integração ${queueIntegration.type} (${queueIntegration?.urlN8N}): ${error}`
          );
        } else {
          logger.debug(response.body);
        }
      });
      return;
    }

    if (queueIntegration.type === "typebot") {
      await typebotSession.listen({ ticket, msg, wbot, typebot: queueIntegration });
    }
  }

  public async verifyQueue(
    wbot: Session,
    msg: proto.IWebMessageInfo,
    ticket: Ticket,
    contact: Contact
  ): Promise<void> {
    const companyId = ticket.companyId;

    const { queues, greetingMessage, maxUseBotQueues, timeUseBotQueues } = await whatsappService.show(
      wbot.id!,
      ticket.companyId
    )

    if (queues.length === 1) {

      const sendGreetingMessageOneQueues = await settingsService.getByKey({
        key: "sendGreetingMessageOneQueues",
        companyId: ticket.companyId
      });

      if (greetingMessage.length > 1 && sendGreetingMessageOneQueues?.value === "enabled") {
        const body = formatBody(`${greetingMessage}`, contact);

        await wbot.sendMessage(getContactJid(contact),
          {
            text: body
          }
        );
      }

      const firstQueue = head(queues);
      let chatbot = false;
      if (firstQueue?.options) {
        chatbot = firstQueue.options.length > 0;
      }

      //inicia integração dialogflow/n8n
      if (
        !msg.key.fromMe &&
        !ticket.isGroup &&
        !isNil(queues[0]?.integrationId)
      ) {
        const integrations = await queueIntegrationsService.show(queues[0].integrationId, companyId);

        await this.handleMessageIntegration(msg, wbot, integrations, ticket)

        await this.ticketsRepository.updateInstance(ticket, {
          useIntegration: true,
          integrationId: integrations.id
        })
        // return;
      }

      await ticketsService.update({
        ticketData: { queueId: firstQueue.id, chatbot, status: "pending" },
        ticketId: ticket.id,
        companyId: ticket.companyId,
      });

      return;
    }

    const selectedOption = MessageParser.getBodyMessage(msg);
    const choosenQueue = queues[+selectedOption - 1];

    const buttonActive = await settingsService.getByKey({
      key: "chatBotType",
      companyId
    });

    if (choosenQueue) {
      let chatbot = false;
      if (choosenQueue?.options) {
        chatbot = choosenQueue.options.length > 0;
      }

      await ticketsService.update({
        ticketData: { queueId: choosenQueue.id, chatbot },
        ticketId: ticket.id,
        companyId: ticket.companyId,
      });

      /* Tratamento para envio de mensagem quando a fila está fora do expediente */
      if (choosenQueue.options.length === 0) {
        const queue = await this.queuesRepository.findById(choosenQueue.id);

        if (this.isOutsideQueueSchedule(queue)) {
            const body = formatBody(`\u200e ${queue.outOfHoursMessage}\n\n*[ # ]* - Voltar ao Menu Principal`, ticket.contact);
            const sentMessage = await wbot.sendMessage(getContactJid(contact), {
              text: body,
            }
            );
            await messagePersistenceService.verifyMessage(sentMessage, ticket, contact);
            await ticketsService.update({
              ticketData: { queueId: null, chatbot },
              ticketId: ticket.id,
              companyId: ticket.companyId,
            });
            return;
        }

        //inicia integração dialogflow/n8n
        if (
          !msg.key.fromMe &&
          !ticket.isGroup &&
          choosenQueue.integrationId
        ) {
          const integrations = await queueIntegrationsService.show(choosenQueue.integrationId, companyId);

          await this.handleMessageIntegration(msg, wbot, integrations, ticket)

          await this.ticketsRepository.updateInstance(ticket, {
            useIntegration: true,
            integrationId: integrations.id
          })
          // return;
        }

        const body = formatBody(`\u200e${choosenQueue.greetingMessage}`, ticket.contact
        );
        if (choosenQueue.greetingMessage) {
          const sentMessage = await wbot.sendMessage(getContactJid(contact), {
            text: body,
          });
          await messagePersistenceService.verifyMessage(sentMessage, ticket, contact);
        }
        if (choosenQueue.mediaPath !== null && choosenQueue.mediaPath !== "") {
          const filePath = path.resolve("public", choosenQueue.mediaPath);

          const optionsMsg = await whatsappMessageSender.getMessageOptions(choosenQueue.mediaName, filePath);

          let sentMessage = await wbot.sendMessage(getContactJid(ticket.contact), { ...optionsMsg });

          await messagePersistenceService.verifyMediaMessage(sentMessage, ticket, contact);
        }
      }

    } else {

      if (maxUseBotQueues && maxUseBotQueues !== 0 && ticket.amountUsedBotQueues >= maxUseBotQueues) {
        // await ticketsService.update({
        //   ticketData: { queueId: queues[0].id },
        //   ticketId: ticket.id
        // });

        return;
      }

      //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
      const ticketTraking = await ticketsService.findOrCreateTraking({ ticketId: ticket.id, companyId });
      let dataLimite = new Date();
      let Agora = new Date();

      if (ticketTraking.chatbotAt !== null) {
        dataLimite.setMinutes(ticketTraking.chatbotAt.getMinutes() + (Number(timeUseBotQueues)));

        if (ticketTraking.chatbotAt !== null && Agora < dataLimite && timeUseBotQueues !== "0" && ticket.amountUsedBotQueues !== 0) {
          return
        }
      }
      await this.ticketsRepository.updateTrakingInstance(ticketTraking, {
        chatbotAt: null
      })

      if (buttonActive.value === "text") {
        return this.sendQueueMenuText(wbot, msg, ticket, contact, queues, greetingMessage);
      }

    }
  }

  public async handleChartbot(
    ticket: Ticket,
    msg: WAMessage,
    wbot: Session,
    dontReadTheFirstQuestion: boolean = false
  ): Promise<void> {
    const queue = await this.queuesRepository.findByIdWithRootOptions(
      ticket.queueId
    );

    const messageBody = MessageParser.getBodyMessage(msg);

    if (messageBody == "#") {
      // voltar para o menu inicial
      await this.ticketsRepository.updateInstance(ticket, { queueOptionId: null, chatbot: false, queueId: null });
      await this.verifyQueue(wbot, msg, ticket, ticket.contact);
      return;
    }

    // voltar para o menu anterior
    if (!isNil(queue) && !isNil(ticket.queueOptionId) && messageBody == "0") {
      const option = await this.queueOptionsRepository.findById(ticket.queueOptionId);
      await this.ticketsRepository.updateInstance(ticket, { queueOptionId: option?.parentId });

      // escolheu uma opção
    } else if (!isNil(queue) && !isNil(ticket.queueOptionId)) {

      const count = await this.queueOptionsRepository.countByParent(ticket.queueOptionId);
      let option: any = {};
      if (count == 1) {
        option = await this.queueOptionsRepository.findOneByParent(ticket.queueOptionId);
      } else {
        option = await this.queueOptionsRepository.findOneByOptionAndParent(
          messageBody || "",
          ticket.queueOptionId
        );
      }
      if (option) {
        await this.ticketsRepository.updateInstance(ticket, { queueOptionId: option?.id });
      }

      // não linha a primeira pergunta
    } else if (!isNil(queue) && isNil(ticket.queueOptionId) && !dontReadTheFirstQuestion) {
      const option = queue?.options.find((o) => o.option == messageBody);
      if (option) {
        await this.ticketsRepository.updateInstance(ticket, { queueOptionId: option?.id });
      }
    }

    await this.ticketsRepository.reload(ticket);

    if (!isNil(queue) && isNil(ticket.queueOptionId)) {

      const queueOptions = await this.queueOptionsRepository.findRootsByQueue(
        ticket.queueId
      );

      const companyId = ticket.companyId;

      const buttonActive = await settingsService.getByKey({
        key: "chatBotType",
        companyId
      });

      if (buttonActive.value === "button" && queueOptions.length <= 4) {
        return this.sendRootOptionsButton(wbot, ticket, queue, queueOptions);
      }

      if (buttonActive.value === "text") {
        return this.sendRootOptionsText(wbot, ticket, queue, queueOptions);
      }

      if (buttonActive.value === "button" && queueOptions.length > 4) {
        return this.sendRootOptionsText(wbot, ticket, queue, queueOptions);
      }
    } else if (!isNil(queue) && !isNil(ticket.queueOptionId)) {
      const currentOption = await this.queueOptionsRepository.findById(
        ticket.queueOptionId
      );
      const queueOptions = await this.queueOptionsRepository.findChildrenOrdered(
        ticket.queueOptionId
      );

      const companyId = ticket.companyId;
      const buttonActive = await settingsService.getByKey({
        key: "chatBotType",
        companyId
      });

      if (buttonActive.value === "list") {
        return this.sendSubOptionsList(wbot, ticket, currentOption, queueOptions);
      }

      if (buttonActive.value === "button" && queueOptions.length <= 4) {
        return this.sendSubOptionsButton(wbot, ticket, currentOption, queueOptions);
      }

      if (buttonActive.value === "text") {
        return this.sendSubOptionsText(wbot, ticket, currentOption, queueOptions);
      }

      if (buttonActive.value === "button" && queueOptions.length > 4) {
        return this.sendSubOptionsText(wbot, ticket, currentOption, queueOptions);
      }
    }
  }

  /**
   * Menu de filas em texto (antiga closure `botText` do verifyQueue): envia as
   * opções numeradas ou a mensagem de opção inválida — lógica verbatim.
   */
  private async sendQueueMenuText(
    wbot: Session,
    msg: proto.IWebMessageInfo,
    ticket: Ticket,
    contact: Contact,
    queues: Queue[],
    greetingMessage: string
  ): Promise<void> {
    let options = "";

    queues.forEach((queue, index) => {
      options += `*[ ${index + 1} ]* - ${queue.name}\n`;
    });

    const textMessage = {
      text: formatBody(`\u200e${greetingMessage}\n\n${options}`, contact),
    };
    const lastMsg = await this.messagesRepository.findLastFromMeByRemoteJid(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`
    );
    let invalidOption = "Opção inválida, por favor, escolha uma opção válida."

    if (!lastMsg || MessageParser.getBodyMessage(msg).includes('#') || lastMsg.body !== textMessage.text) {
      const sendMsg = await wbot.sendMessage(getContactJid(contact),
        textMessage
      );
      await messagePersistenceService.verifyMessage(sendMsg, ticket, ticket.contact);

    } else if (lastMsg.body !== invalidOption) {
      textMessage.text = invalidOption
      const sendMsg = await wbot.sendMessage(getContactJid(contact),
        textMessage
      );
      await messagePersistenceService.verifyMessage(sendMsg, ticket, ticket.contact);
    }
  }

  /** Opções raiz por botões (antiga closure `botButton` do handleChartbot). */
  private async sendRootOptionsButton(
    wbot: Session,
    ticket: Ticket,
    queue: Queue,
    queueOptions: QueueOption[]
  ): Promise<void> {
    const buttons = [];
    queueOptions.forEach((option, i) => {
      buttons.push({
        buttonId: `${option.option}`,
        buttonText: { displayText: option.title },
        type: 4
      });
    });
    buttons.push({
      buttonId: `#`,
      buttonText: { displayText: "Menu inicial *[ 0 ]* Menu anterior" },
      type: 4
    });

    const buttonMessage = {
      text: formatBody(`\u200e${queue.greetingMessage}`, ticket.contact),
      buttons,
      headerType: 4
    };

    const sendMsg = await wbot.sendMessage(getContactJid(ticket.contact),
      buttonMessage
    );

    await messagePersistenceService.verifyMessage(sendMsg, ticket, ticket.contact);
  }

  /** Opções raiz em texto (antiga closure `botText` do handleChartbot). */
  private async sendRootOptionsText(
    wbot: Session,
    ticket: Ticket,
    queue: Queue,
    queueOptions: QueueOption[]
  ): Promise<void> {
    let options = "";

    queueOptions.forEach((option, i) => {
      options += `*[ ${option.option} ]* - ${option.title}\n`;
    });
    //options += `\n*[ 0 ]* - Menu anterior`;
    options += `\n*[ # ]* - Menu inicial`;

    const textMessage = {
      text: formatBody(`\u200e${queue.greetingMessage}\n\n${options}`, ticket.contact),
    };

    const sendMsg = await wbot.sendMessage(getContactJid(ticket.contact), textMessage);

    await messagePersistenceService.verifyMessage(sendMsg, ticket, ticket.contact);
  }

  /** Sub-opções em lista (antiga closure `botList` do handleChartbot). */
  private async sendSubOptionsList(
    wbot: Session,
    ticket: Ticket,
    currentOption: QueueOption,
    queueOptions: QueueOption[]
  ): Promise<void> {
    const sectionsRows = [];

    queueOptions.forEach((option, i) => {
      sectionsRows.push({
        title: option.title,
        rowId: `${option.option}`
      });
    });
    sectionsRows.push({
      title: "Menu inicial *[ 0 ]* Menu anterior",
      rowId: `#`
    });
    const sections = [
      {
        rows: sectionsRows
      }
    ];

    const listMessage = {
      text: formatBody(`\u200e${currentOption.message}`, ticket.contact),
      buttonText: "Escolha uma opção",
      sections
    };

    const sendMsg = await wbot.sendMessage(getContactJid(ticket.contact),
      listMessage
    );

    await messagePersistenceService.verifyMessage(sendMsg, ticket, ticket.contact);
  }

  /** Sub-opções por botões (antiga closure `botButton` do handleChartbot). */
  private async sendSubOptionsButton(
    wbot: Session,
    ticket: Ticket,
    currentOption: QueueOption,
    queueOptions: QueueOption[]
  ): Promise<void> {
    const buttons = [];
    queueOptions.forEach((option, i) => {
      buttons.push({
        buttonId: `${option.option}`,
        buttonText: { displayText: option.title },
        type: 4
      });
    });
    buttons.push({
      buttonId: `#`,
      buttonText: { displayText: "Menu inicial *[ 0 ]* Menu anterior" },
      type: 4
    });

    const buttonMessage = {
      text: formatBody(`\u200e${currentOption.message}`, ticket.contact),
      buttons,
      headerType: 4
    };

    const sendMsg = await wbot.sendMessage(getContactJid(ticket.contact),
      buttonMessage
    );

    await messagePersistenceService.verifyMessage(sendMsg, ticket, ticket.contact);
  }

  /** Sub-opções em texto (antiga closure `botText` do handleChartbot). */
  private async sendSubOptionsText(
    wbot: Session,
    ticket: Ticket,
    currentOption: QueueOption,
    queueOptions: QueueOption[]
  ): Promise<void> {
    let options = "";

    queueOptions.forEach((option, i) => {
      options += `*[ ${option.option} ]* - ${option.title}\n`;
    });
    options += `\n*[ 0 ]* - Menu anterior`;
    options += `\n*[ # ]* - Menu inicial`;
    const textMessage = {
      text: formatBody(`\u200e${currentOption.message}\n\n${options}`, ticket.contact),
    };

    const sendMsg = await wbot.sendMessage(getContactJid(ticket.contact), textMessage);

    await messagePersistenceService.verifyMessage(sendMsg, ticket, ticket.contact);
    if (currentOption.mediaPath !== null && currentOption.mediaPath !== "") {

      const filePath = path.resolve("public", currentOption.mediaPath);

      const optionsMsg = await whatsappMessageSender.getMessageOptions(currentOption.mediaName, filePath);

      let sentMessage = await wbot.sendMessage(getContactJid(ticket.contact), { ...optionsMsg });

      await messagePersistenceService.verifyMediaMessage(sentMessage, ticket, ticket.contact);
    }
  }
}

export const chatbotFlowService = new ChatbotFlowService();
