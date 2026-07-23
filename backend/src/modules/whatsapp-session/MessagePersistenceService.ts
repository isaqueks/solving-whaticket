import { writeFile } from "fs";
import { join } from "path";
import { promisify } from "util";

import { downloadMediaMessage, proto, WAMessage } from "baileys";

import { appConfig } from "../../config/AppConfig";
import formatBody from "../../shared/helpers/Mustache";
import AppError from "../../shared/errors/AppError";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { logger } from "../../utils/logger";

import Contact from "../contacts/models/Contact";
import Message from "../messages/models/Message";
import { MessagesRepository } from "../messages/MessagesRepository";
// Ciclo MessagesService ⇄ MessagePersistenceService: usar o singleton SEMPRE
// dentro do corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { messagesService } from "../messages/MessagesService";
import Ticket from "../tickets/models/Ticket";
import { TicketsRepository } from "../tickets/TicketsRepository";

import { MessageParser } from "./MessageParser";

const writeFileAsync = promisify(writeFile);

/** Mídia baixada de uma mensagem (forma original do downloadMedia). */
interface DownloadedMedia {
  data: Buffer | undefined;
  mimetype: string;
  filename: string;
}

/**
 * Persistência de mensagens recebidas/enviadas pelo wbot (antigo
 * `wbotMessagePersistence`): grava texto e mídia via MessagesService, atualiza
 * o lastMessage do ticket e reabre tickets fechados. Caminho quente — lógica
 * preservada linha a linha; eventos via RealtimeGateway.
 */
export class MessagePersistenceService {
  constructor(
    private readonly messagesRepository = new MessagesRepository(),
    private readonly ticketsRepository = new TicketsRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async verifyMediaMessage(
    msg: WAMessage,
    ticket: Ticket,
    contact: Contact
  ): Promise<Message> {
    const quotedMsg = await this.verifyQuotedMessage(msg);
    const media = await this.downloadMedia(msg);

    if (!media) {
      throw new AppError("ERR_WAPP_DOWNLOAD_MEDIA");
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

    const body = MessageParser.getBodyMessage(msg);

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
      // `any` justificado (doc 04 §4): participantAlt não existe nos typings
      // do Baileys, mas vem no payload real (lógica original).
      participant: (msg.key as any)['participantAlt'] || msg.key.participant,
      dataJson: JSON.stringify(msg),
    };

    await this.ticketsRepository.updateInstance(ticket, {
      lastMessage: body || media.filename,
      updatedAt: new Date()
    });

    const newMessage = await messagesService.create({
      messageData,
      companyId: ticket.companyId,
    });

    await this.reopenTicketIfClosed(msg, ticket);

    return newMessage;
  }

  public async verifyMessage(
    msg: proto.IWebMessageInfo,
    ticket: Ticket,
    contact: Contact
  ): Promise<void> {
    const quotedMsg = await this.verifyQuotedMessage(msg);
    const body = MessageParser.getBodyMessage(msg);
    const isEdited = MessageParser.getTypeMessage(msg) == 'editedMessage';

    const messageData = {
      id: msg.key.id,
      ticketId: ticket.id,
      contactId: msg.key.fromMe ? undefined : contact.id,
      body,
      fromMe: msg.key.fromMe,
      mediaType: MessageParser.getTypeMessage(msg),
      read: msg.key.fromMe,
      quotedMsgId: quotedMsg?.id,
      ack: msg.status || 1,
      remoteJid: msg.key.remoteJid,
      // `any` justificado (doc 04 §4): participantAlt não existe nos typings
      // do Baileys, mas vem no payload real (lógica original).
      participant: (msg.key as any)['participantAlt'] || msg.key.participant,
      dataJson: JSON.stringify(msg),
      isEdited: isEdited,
    };

    if (body) {
      await this.ticketsRepository.updateInstance(ticket, {
        lastMessage: body,
        updatedAt: new Date()
      });
    }

    await messagesService.create({ messageData, companyId: ticket.companyId });

    if (appConfig.wpp.messageWebhookUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          await fetch(`${appConfig.wpp.messageWebhookUrl}?wppName=${ticket.whatsapp.name}`, {
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

    await this.reopenTicketIfClosed(msg, ticket);
  }

  private async downloadMedia(msg: WAMessage): Promise<DownloadedMedia | null> {
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

  private async verifyQuotedMessage(
    msg: proto.IWebMessageInfo
  ): Promise<Message | null> {
    if (!msg) return null;
    const quoted = MessageParser.getQuotedMessageId(msg);

    if (!quoted) return null;

    const quotedMsg = await this.messagesRepository.findById(quoted);

    if (!quotedMsg) return null;

    return quotedMsg;
  }

  /**
   * Reabre (status "pending") um ticket fechado quando o cliente envia uma nova
   * mensagem, notificando o frontend nas salas correspondentes.
   */
  private async reopenTicketIfClosed(
    msg: proto.IWebMessageInfo,
    ticket: Ticket
  ): Promise<void> {
    if (msg.key.fromMe || ticket.status !== "closed") return;

    await this.ticketsRepository.updateInstance(ticket, { status: "pending" });
    await this.ticketsRepository.reloadWithQueueUserContact(ticket);

    this.realtime.emitTicketToStatusRooms(
      {
        companyId: ticket.companyId,
        status: "closed",
        queueId: ticket.queueId
      },
      {
        action: "delete",
        ticket,
        ticketId: ticket.id
      }
    );

    this.realtime.emitTicketToStatusRooms(
      {
        companyId: ticket.companyId,
        status: ticket.status,
        queueId: ticket.queueId,
        ticketId: ticket.id.toString()
      },
      {
        action: "update",
        ticket,
        ticketId: ticket.id
      }
    );
  }
}

export const messagePersistenceService = new MessagePersistenceService();
