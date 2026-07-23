import { writeFile } from "fs";
import { join } from "path";
import { promisify } from "util";

import { downloadMediaMessage, proto, WAMessage } from "baileys";

import formatBody from "../../helpers/Mustache";
import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import { logger } from "../../utils/logger";
import CreateMessageService from "../MessageServices/CreateMessageService";
import {
  getBodyMessage,
  getQuotedMessageId,
  getTypeMessage
} from "./wbotMessageParser";

const writeFileAsync = promisify(writeFile);

const downloadMedia = async (msg: WAMessage) => {
  let buffer;
  try {
    buffer = await downloadMediaMessage(msg, "buffer", {});
  } catch (err) {
    // Mantém o fluxo: a mensagem ainda é registrada mesmo sem o arquivo
    logger.error(`Erro ao baixar mídia da mensagem ${msg.key?.id}: ${err}`);
  }

  let filename = msg.message?.documentMessage?.fileName || "";

  const mimeSource =
    msg.message?.imageMessage ||
    msg.message?.audioMessage ||
    msg.message?.videoMessage ||
    msg.message?.stickerMessage ||
    msg.message?.documentMessage ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

  if (!mimeSource) {
    logger.warn(`Mimetype não identificado para a mensagem ${msg.key?.id}`);
    return null;
  }

  if (!filename) {
    const ext = mimeSource.mimetype.split("/")[1].split(";")[0];
    filename = `${new Date().getTime()}.${ext}`;
  } else {
    filename = `${new Date().getTime()}_${filename}`;
  }

  return {
    data: buffer,
    mimetype: mimeSource.mimetype,
    filename
  };
}

const verifyQuotedMessage = async (
  msg: proto.IWebMessageInfo
): Promise<Message | null> => {
  if (!msg) return null;
  const quoted = getQuotedMessageId(msg);

  if (!quoted) return null;

  const quotedMsg = await Message.findOne({
    where: { id: quoted },
  });

  if (!quotedMsg) return null;

  return quotedMsg;
};

/**
 * Reabre (status "pending") um ticket fechado quando o cliente envia uma nova
 * mensagem, notificando o frontend nas salas correspondentes.
 */
const reopenTicketIfClosed = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket
): Promise<void> => {
  if (msg.key.fromMe || ticket.status !== "closed") return;

  const io = getIO();

  await ticket.update({ status: "pending" });
  await ticket.reload({
    include: [
      { model: Queue, as: "queue" },
      { model: User, as: "user" },
      { model: Contact, as: "contact" }
    ]
  });

  io.to(`company-${ticket.companyId}-closed`)
    .to(`queue-${ticket.queueId}-closed`)
    .emit(`company-${ticket.companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });

  io.to(`company-${ticket.companyId}-${ticket.status}`)
    .to(`queue-${ticket.queueId}-${ticket.status}`)
    .to(ticket.id.toString())
    .emit(`company-${ticket.companyId}-ticket`, {
      action: "update",
      ticket,
      ticketId: ticket.id
    });
};

export const verifyMediaMessage = async (
  msg: WAMessage,
  ticket: Ticket,
  contact: Contact
): Promise<Message> => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const media = await downloadMedia(msg);

  if (!media) {
    throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
  }

  if (!media.filename) {
    const ext = media.mimetype.split("/")[1].split(";")[0];
    media.filename = `${new Date().getTime()}.${ext}`;
  }

  if (media.data) {
    try {
      await writeFileAsync(
        join(__dirname, "..", "..", "..", "public", media.filename),
        media.data,
        "base64"
      );
    } catch (err) {
      logger.error(err);
    }
  }

  const body = getBodyMessage(msg);


  const messageData = {
    id: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body: body ? formatBody(body, ticket.contact) : media.filename,
    fromMe: msg.key.fromMe,
    read: msg.key.fromMe,
    mediaUrl: media.filename,
    mediaType: media.mimetype.split("/")[0],
    quotedMsgId: quotedMsg?.id,
    ack: msg.status,
    remoteJid: msg.key.remoteJid,
    participant: msg.key['participantAlt'] || msg.key.participant,
    dataJson: JSON.stringify(msg),
  };

  await ticket.update({
    lastMessage: body || media.filename,
    updatedAt: new Date()
  });

  const newMessage = await CreateMessageService({
    messageData,
    companyId: ticket.companyId,
  });


  await reopenTicketIfClosed(msg, ticket);

  return newMessage;
};

export const verifyMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact
) => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const body = getBodyMessage(msg);
  const isEdited = getTypeMessage(msg) == 'editedMessage';

  const messageData = {
    id: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body,
    fromMe: msg.key.fromMe,
    mediaType: getTypeMessage(msg),
    read: msg.key.fromMe,
    quotedMsgId: quotedMsg?.id,
    ack: msg.status || 1,
    remoteJid: msg.key.remoteJid,
    participant: msg.key['participantAlt'] || msg.key.participant,
    dataJson: JSON.stringify(msg),
    isEdited: isEdited,
  };

  if (body) {
    await ticket.update({
      lastMessage: body,
      updatedAt: new Date()
    });
  }

  await CreateMessageService({ messageData, companyId: ticket.companyId });

  if (process.env.MESSAGE_WEBHOOK) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        await fetch(`${process.env.MESSAGE_WEBHOOK}?wppName=${ticket.whatsapp.name}`, {
          method: "POST",
          body: JSON.stringify({
            type: 'receveid_message',
            message: msg,
            extra: {
              ticket,
              contact
            }
          }),
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      logger.error(`Error sending MESSAGE_WEBHOOK. Err: ${err}`);
    }
  }

  await reopenTicketIfClosed(msg, ticket);
};
