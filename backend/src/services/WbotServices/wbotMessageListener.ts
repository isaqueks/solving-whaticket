import { isNil } from "lodash";

import {
  MessageUpsertType,
  proto,
  WAMessage,
  WAMessageUpdate,
  WASocket,
} from "baileys";
import moment from "moment";

import { debounce } from "../../helpers/Debounce";
import formatBody from "../../helpers/Mustache";
import { getContactJid } from "../../helpers/getContactJid";
import { cacheLayer } from "../../libs/cache";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Setting from "../../models/Setting";
import { logger } from "../../utils/logger";
import VerifyCurrentSchedule from "../CompanyService/VerifyCurrentSchedule";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import NotifyWppReceiveMessage from "./NotifyWppReceiveMessage";
import { Session } from "./types";
import {
  verifyCampaignMessageAndCloseTicket,
  verifyRecentCampaign
} from "./wbotCampaignHooks";
import {
  handleChartbot,
  handleMessageIntegration,
  isOutsideQueueSchedule,
  verifyQueue
} from "./wbotChatbotFlow";
import { verifyContact, verifyGroup } from "./wbotContactVerifier";
import { handleMsgAck } from "./wbotMessageAck";
import {
  filterMessages,
  getBodyMessage,
  getTypeMessage,
  isValidMsg
} from "./wbotMessageParser";
import { verifyMediaMessage, verifyMessage } from "./wbotMessagePersistence";
import { handleRating, verifyRating } from "./wbotRating";

// Re-exporta a API pública histórica deste módulo (importadores externos)
export { getBodyMessage, getQuotedMessageId } from "./wbotMessageParser";
export { verifyMessage } from "./wbotMessagePersistence";
export { verifyRating, handleRating } from "./wbotRating";
export { handleMessageIntegration } from "./wbotChatbotFlow";

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

const handleMessage = async (
  msg: WAMessage,
  wbot: Session,
  companyId: number
): Promise<void> => {

  if (!isValidMsg(msg)) {
    return;
  }
  try {
    let groupContact: Contact | undefined;

    const isGroup = msg.key.remoteJid?.endsWith("@g.us");

    const msgIsGroupBlock = await Setting.findOne({
      where: {
        companyId,
        key: "CheckMsgIsGroup",
      },
    });

    const bodyMessage = getBodyMessage(msg);
    const msgType = getTypeMessage(msg);

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
      groupContact = await verifyGroup(msg, wbot, companyId);
    }

    const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);
    const contact = await verifyContact(msg, wbot, companyId);

    // Registra "último contato" no sistema de inadimplência apenas quando o
    // CLIENTE nos envia uma mensagem em uma conversa individual (mensagens que
    // NÓS enviamos não contam como contato do cliente). Fire-and-forget: a
    // chamada trata os próprios erros e nunca bloqueia/interrompe o
    // processamento da mensagem.
    if (!msg.key.fromMe && !isGroup) {
      NotifyWppReceiveMessage(contact.number).catch(() => {
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

    const lastMessage = await Message.findOne({
      where: {
        contactId: contact.id,
        companyId,
      },
      order: [["createdAt", "DESC"]],
    });

    if (unreadMessages === 0 && whatsapp.complationMessage && formatBody(whatsapp.complationMessage, contact).trim().toLowerCase() === lastMessage?.body?.trim().toLowerCase()) {
      return;
    }

    const ticket = await FindOrCreateTicketService(contact, wbot.id!, unreadMessages, companyId, groupContact);

    // voltar para o menu inicial
    if (bodyMessage == "#") {
      await ticket.update({
        queueOptionId: null,
        chatbot: false,
        queueId: null,
      });
      await verifyQueue(wbot, msg, ticket, ticket.contact);
      return;
    }


    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      whatsappId: whatsapp?.id
    });

    // Atualiza o ticket se a ultima mensagem foi enviada por mim, para que possa ser finalizado.
    try {
      await ticket.update({
        fromMe: msg.key.fromMe,
      });
    } catch (e) {
      logger.error(e);
    }

    if (hasMedia) {
      await verifyMediaMessage(msg, ticket, contact);
    } else {
      await verifyMessage(msg, ticket, contact);
    }

    const currentSchedule = await VerifyCurrentSchedule(companyId);
    const scheduleType = await Setting.findOne({
      where: {
        companyId,
        key: "scheduleType"
      }
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
          const queue = await Queue.findByPk(ticket.queueId);

          if (isOutsideQueueSchedule(queue)) {
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
        if (ticketTraking !== null && verifyRating(ticketTraking)) {
          const rate = parseFloat(bodyMessage);
          if (!Number.isNaN(rate)) {
            await handleRating(rate, ticket, ticketTraking);
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
      const integrations = await ShowQueueIntegrationService(whatsapp.integrationId, companyId);

      await handleMessageIntegration(msg, wbot, integrations, ticket)

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

      const integrations = await ShowQueueIntegrationService(ticket.integrationId, companyId);

      await handleMessageIntegration(msg, wbot, integrations, ticket)

    }

    if (
      !ticket.queue &&
      !ticket.isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1 &&
      !ticket.useIntegration
    ) {

      await verifyQueue(wbot, msg, ticket, contact);

      if (ticketTraking.chatbotAt === null) {
        await ticketTraking.update({
          chatbotAt: moment().toDate(),
        })
      }
    }

    const dontReadTheFirstQuestion = ticket.queue === null;

    await ticket.reload();

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
        const queue = await Queue.findByPk(ticket.queueId);

        if (isOutsideQueueSchedule(queue)) {
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

      const lastMessage = await Message.findOne({
        where: {
          ticketId: ticket.id,
          fromMe: true
        },
        order: [["createdAt", "DESC"]]
      });

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
        await handleChartbot(ticket, msg, wbot);
      }
    }
    if (whatsapp.queues.length > 1 && ticket.queue) {
      if (ticket.chatbot && !msg.key.fromMe) {
        await handleChartbot(ticket, msg, wbot, dontReadTheFirstQuestion);
      }
    }

  } catch (err) {
    logger.error(`Error handling whatsapp message: Err: ${err}`);
  }
};

const wbotMessageListener = async (wbot: Session, companyId: number): Promise<void> => {
  try {
    wbot.ev.on("messages.upsert", async (messageUpsert: ImessageUpsert) => {
      const messages = messageUpsert.messages.filter(
        filterMessages
      ) as WAMessage[];

      // Processamento sequencial: preserva a ordem das mensagens do lote e
      // evita corrida no FindOrCreateTicketService (tickets duplicados para
      // duas mensagens rápidas de um contato novo)
      for (const message of messages) {
        const messageExists = await Message.count({
          where: { id: message.key.id!, companyId }
        });

        if (!messageExists) {
          await handleMessage(message, wbot, companyId);
          await verifyRecentCampaign(message, companyId);
          await verifyCampaignMessageAndCloseTicket(message, companyId);
        }
      }
    });

    wbot.ev.on("messages.update", (messageUpdate: WAMessageUpdate[]) => {
      if (messageUpdate.length === 0) return;
      messageUpdate.forEach(async (message: WAMessageUpdate) => {
        (wbot as WASocket)!.readMessages([message.key])

        handleMsgAck(message, message.update.status);
      });
    });

  } catch (error) {
    logger.error(`Error handling wbot message listener. Err: ${error}`);
  }
};

export { handleMessage, wbotMessageListener };
