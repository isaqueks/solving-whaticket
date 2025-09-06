import * as Sentry from "@sentry/node";
import { WAMessage } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

import formatBody from "../../helpers/Mustache";
import { map_msg } from "../../utils/global";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import { getIO } from "../../libs/socket";

interface Request {
  body: string;
  ticket: Ticket;
  userId: number;
  quotedMsg?: Message;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  userId
}: Request): Promise<WAMessage> => {
  let options = {};
  const wbot = await GetTicketWbot(ticket);
  const number = `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;
  console.log("number", number);

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
  if (ticket.useIntegration) {
    const res = await ticket.update({ useIntegration: false });
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

  try {
    console.log('body:::::::::::::::::::::::::::', body)
    map_msg.set(ticket.contact.number, { lastSystemMsg: body })
    console.log('lastSystemMsg:::::::::::::::::::::::::::', ticket.contact.number)
    const sentMessage = await wbot.sendMessage(number, {
      text: formatBody(body, ticket.contact)
    },
      {
        ...options
      }
    );
    await ticket.update({ lastMessage: formatBody(body, ticket.contact) });
    console.log("Message sent", sentMessage);
    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
