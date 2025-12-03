import * as Sentry from "@sentry/node";
import { WAMessage } from "baileys";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

import formatBody from "../../helpers/Mustache";
import { map_msg } from "../../utils/global";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import { getIO } from "../../libs/socket";
import { getContactJid } from "../../helpers/getContactJid";
import { QUEUES } from "../../utils/queueConsts";

interface Request {
  body: string;
  ticket: Ticket;
  userId: number | null;
  quotedMsg?: Message;
  editMsg?: Message;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  editMsg,
  userId
}: Request): Promise<WAMessage> => {
  let options = {};
  const wbot = await GetTicketWbot(ticket);
  const jid = getContactJid(ticket.contact);
  console.log("number", jid);

  let changed = false;

  if (ticket.status !== 'open') {
    const res = await UpdateTicketService({
      ticketId: ticket.id,
      companyId: ticket.companyId,
      ticketData: {
        userId: userId,
        status: 'open',
      }
    });
    ticket = res.ticket;
    changed = true;
  }
  if (ticket.useIntegration || ticket.queueId === QUEUES.BUSCAR_BOLETO) {
    const res = await ticket.update({
      useIntegration: false,
      typebotSessionId: null,
      integrationId: null,
      typebotStatus: false,
      queueId: QUEUES.FALAR_COM_ATENDENTE
    });
    ticket = res;
    changed = true;
  }

  if (changed) {
    const io = getIO();
    io.to(`company-${ticket.companyId}-${ticket.status}`)
      .to(`queue-${ticket.queueId}-${ticket.status}`)
      .to(ticket.id.toString())
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id,
      });
  }

  if (quotedMsg) {
    const chatMessages = await Message.findOne({
      where: {
        id: quotedMsg.id
      }
    });

    if (chatMessages) {
      const msgFound = JSON.parse(chatMessages.dataJson);

      options = {
        quoted: {
          key: msgFound.key,
          message: {
            extendedTextMessage: msgFound.message.extendedTextMessage
          }
        }
      };
    }

  }

  let editMessageObject: Message;
  if (editMsg) {
    const chatMessages = await Message.findOne({
      where: {
        id: editMsg.id
      }
    });

    if (chatMessages) {
      editMessageObject = chatMessages;
    }
  }

  try {
    console.log('body:::::::::::::::::::::::::::', body)
    map_msg.set(ticket.contact.number, { lastSystemMsg: body })
    console.log('lastSystemMsg:::::::::::::::::::::::::::', ticket.contact.number);

    let extra = {};
    if (editMessageObject) {
      extra = {
        edit: JSON.parse(editMessageObject.dataJson).key
      }
    }

    const sentMessage = await wbot.sendMessage(jid, {
      text: formatBody(body, ticket.contact),
      ...extra
    },
      {
        ...options
      }
    );
    // await ticket.update({ lastMessage: formatBody(body, ticket.contact) });
    console.log("Message sent", sentMessage);
    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
