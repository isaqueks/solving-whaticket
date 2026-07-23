import * as Sentry from "@sentry/node";
import { AnyMessageContent, proto, WAMessage, WASocket } from "baileys";
import { exec } from "child_process";
import fs from "fs";
import mime from "mime-types";
import path from "path";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";

import formatBody from "../../shared/helpers/Mustache";
import AppError from "../../shared/errors/AppError";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { logger } from "../../utils/logger";
import { QUEUES } from "../../utils/queueConsts";

import { getContactJid } from "../contacts/getContactJid";
import { ContactsRepository } from "../contacts/ContactsRepository";
import Message from "../messages/models/Message";
import { MessagesRepository } from "../messages/MessagesRepository";
// Ciclo MessagesService ⇄ WhatsappMessageSender: usar o singleton SEMPRE
// dentro do corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { messagesService } from "../messages/MessagesService";
import Ticket from "../tickets/models/Ticket";
import { TicketsRepository } from "../tickets/TicketsRepository";
// Ciclo TicketsService ⇄ WhatsappMessageSender: idem — uso apenas em tempo de
// chamada, nunca capturado no construtor.
import { ticketsService } from "../tickets/TicketsService";
import Whatsapp from "../whatsapp/models/Whatsapp";
// Ciclo WhatsappService (getWhatsappWbot) ⇄ módulo da sessão: idem.
import { whatsappService } from "../whatsapp/WhatsappService";

import { sessionManager } from "./SessionManager";

/** Entrada do envio de texto (antigo SendWhatsAppMessage). */
export interface SendTextRequest {
  body: string;
  ticket: Ticket;
  userId: number | null;
  quotedMsg?: Message;
  editMsg?: Message;
}

/** Entrada do envio de mídia (antigo SendWhatsAppMedia). */
export interface SendMediaRequest {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

/** Entrada do encaminhamento (antigo ForwardWhatsAppMessage). */
export interface ForwardMessagesRequest {
  contactId: number;
  whatsappId?: number;
  messagesId: string[];
}

/** Entrada do envio cru por número (antigo helpers/SendMessage). */
export type MessageData = {
  number: number | string;
  body: string;
  mediaPath?: string;
  fileName?: string;
};

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

/**
 * Envio de mensagens pelo WhatsApp (absorve `SendWhatsAppMessage`,
 * `SendWhatsAppMedia`, `DeleteWhatsAppMessage`, `ForwardWhatsAppMessage` e
 * `helpers/SendMessage`). Lógica preservada linha a linha — em especial o
 * roteamento BUSCAR_BOLETO → FALAR_COM_ATENDENTE do envio de texto
 * (integração do dono, comportamento CONGELADO).
 */
export class WhatsappMessageSender {
  constructor(
    private readonly messagesRepository = new MessagesRepository(),
    private readonly contactsRepository = new ContactsRepository(),
    private readonly ticketsRepository = new TicketsRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  /** Envio de texto a partir de um ticket (antigo SendWhatsAppMessage). */
  public async sendText({
    body,
    ticket,
    quotedMsg,
    editMsg,
    userId
  }: SendTextRequest): Promise<WAMessage> {
    let options = {};
    const wbot = await ticketsService.getTicketWbot(ticket);
    const jid = getContactJid(ticket.contact);

    let changed = false;

    if (ticket.status !== 'open') {
      const res = await ticketsService.update({
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
    // Roteamento BUSCAR_BOLETO → FALAR_COM_ATENDENTE (integração do dono,
    // comportamento CONGELADO — condição e campos idênticos ao original).
    if (ticket.useIntegration || ticket.queueId === QUEUES.BUSCAR_BOLETO) {
      const res = await this.ticketsRepository.updateInstance(ticket, {
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
          ticketId: ticket.id,
        }
      );
    }

    if (quotedMsg) {
      const chatMessages = await this.messagesRepository.findById(quotedMsg.id);

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
      const chatMessages = await this.messagesRepository.findById(editMsg.id);

      if (chatMessages) {
        editMessageObject = chatMessages;
      }
    }

    try {
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
      return sentMessage;
    } catch (err) {
      Sentry.captureException(err);
      logger.error(err);
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }
  }

  /** Envio de mídia a partir de um ticket (antigo SendWhatsAppMedia). */
  public async sendMedia({
    media,
    ticket,
    body
  }: SendMediaRequest): Promise<WAMessage> {
    try {
      const wbot = await ticketsService.getTicketWbot(ticket);

      const pathMedia = media.path;
      const typeMessage = media.mimetype.split("/")[0];
      let options: AnyMessageContent;
      const bodyMessage = formatBody(body, ticket.contact)

      if (typeMessage === "video") {
        options = {
          video: await fs.promises.readFile(pathMedia),
          caption: bodyMessage,
          fileName: media.originalname
          // gifPlayback: true
        };
      } else if (typeMessage === "audio") {
        const typeAudio = media.originalname.includes("audio-record-site");
        if (typeAudio) {
          const convert = await this.processAudio(media.path);
          options = {
            audio: await fs.promises.readFile(convert),
            mimetype: typeAudio ? "audio/mp4" : media.mimetype,
            ptt: true
          };
          await fs.promises.unlink(convert);
        } else {
          const convert = await this.processAudioFile(media.path);
          options = {
            audio: await fs.promises.readFile(convert),
            mimetype: typeAudio ? "audio/mp4" : media.mimetype
          };
          await fs.promises.unlink(convert);
        }
      } else if (typeMessage === "document" || typeMessage === "text") {
        options = {
          document: await fs.promises.readFile(pathMedia),
          caption: bodyMessage,
          fileName: media.originalname,
          mimetype: media.mimetype
        };
      } else if (typeMessage === "application") {
        options = {
          document: await fs.promises.readFile(pathMedia),
          caption: bodyMessage,
          fileName: media.originalname,
          mimetype: media.mimetype
        };
      } else {
        options = {
          image: await fs.promises.readFile(pathMedia),
          caption: bodyMessage,
        };
      }

      console.log("options", options);
      const sentMessage = await wbot.sendMessage(getContactJid(ticket.contact),
        {
          ...options
        }
      );

      // await ticket.update({ lastMessage: bodyMessage });

      return sentMessage;
    } catch (err) {
      Sentry.captureException(err);
      console.log(err);
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }
  }

  /** Apaga a mensagem no WhatsApp e marca isDeleted (antigo DeleteWhatsAppMessage). */
  public async delete(messageId: string): Promise<Message> {
    const message = await this.messagesRepository.findByIdWithTicketAndContact(
      messageId
    );

    if (!message) {
      throw new AppError("No message found with this ID.");
    }

    const { ticket } = message;

    const messageToDelete = await messagesService.getWbotMessage(
      ticket,
      messageId
    );

    try {
      const wbot = await ticketsService.getTicketWbot(ticket);
      const messageDelete = messageToDelete as proto.WebMessageInfo;

      const menssageDelete = messageToDelete as Message;

      await (wbot as WASocket).sendMessage(menssageDelete.remoteJid, {
        delete: {
          id: menssageDelete.id,
          remoteJid: menssageDelete.remoteJid,
          participant: menssageDelete.participant,
          fromMe: menssageDelete.fromMe
        }
      });

    } catch (err) {
      throw new AppError("ERR_DELETE_WAPP_MSG");
    }
    await this.messagesRepository.updateInstance(message, { isDeleted: true });

    return message;
  }

  /** Encaminha mensagens para outro contato (antigo ForwardWhatsAppMessage). */
  public async forward({
    contactId,
    whatsappId,
    messagesId
  }: ForwardMessagesRequest): Promise<void> {
    const contact = await this.contactsRepository.findById(contactId);
    if (!contact) {
      throw new AppError("Contact not found");
    }

    const wbot = await sessionManager.getWbot(whatsappId);

    const messages = await this.messagesRepository.findAllByIdsOrdered(
      messagesId
    );

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const jid = getContactJid(contact);
    for (const message of messages) {

      const fileName = message.mediaUrl ? message.mediaUrl.split('/').pop() : null;

      if (['conversation', 'editedMessage', 'extendedTextMessage'].includes(message.mediaType)) {
        await wbot.sendMessage(jid, { text: message.body });
      }
      else if (['audio', 'image', 'application', 'video'].includes(message.mediaType)) {
        const mimeType = mime.lookup(message.mediaUrl);
        const opt = {
          fileName: fileName,
          caption: message.body,
          mimetype: mimeType || 'application'
        } as any;

        if (message.mediaType === 'audio') {
          opt.audio = await fs.promises.readFile(`${publicFolder}/${fileName}`);
          opt.ptt = true
          opt.mimetype = 'audio/ogg; codecs=opus';
        } else if (message.mediaType === 'image') {
          opt.image = await fs.promises.readFile(`${publicFolder}/${fileName}`);
        } else if (message.mediaType === 'application') {
          opt.document = await fs.promises.readFile(`${publicFolder}/${fileName}`);
        } else if (message.mediaType === 'video') {
          opt.video = await fs.promises.readFile(`${publicFolder}/${fileName}`);
        }

        await wbot.sendMessage(jid, {
          ...opt,
        });

        await sleep(1500);
      }
    }
  }

  /**
   * Envio cru por número, fora do fluxo de tickets (antigo helpers/SendMessage
   * — consumido pelos jobs de mensagens/agendamentos e pela integração).
   */
  public async sendRaw(
    whatsapp: Whatsapp,
    messageData: MessageData
  ): Promise<any> {
    try {
      const wbot = await whatsappService.getWhatsappWbot(whatsapp);
      const chatId = `${messageData.number}@s.whatsapp.net`;

      let message;

      if (messageData.mediaPath) {
        const options = await this.getMessageOptions(
          messageData.fileName,
          messageData.mediaPath,
          messageData.body
        );
        if (options) {
          message = await wbot.sendMessage(chatId, {
            ...options
          });
        }
      } else {
        const body = `\u200e ${messageData.body}`;
        message = await wbot.sendMessage(chatId, { text: body });
      }

      return message;
    } catch (err: any) {
      // Exceção justificada (doc 04 §6): re-throw consumido pelos processors
      // Bull (retry/Sentry), onde um Error nativo é semanticamente correto —
      // não é caminho HTTP/negócio, então não vira AppError na B0.
      throw new Error(err);
    }
  }

  /**
   * Monta o AnyMessageContent para um arquivo local (antigo getMessageOptions
   * — usado pelo chatbot, pelos jobs de campanha e pelo envio cru).
   */
  public async getMessageOptions(
    fileName: string,
    pathMedia: string,
    body?: string
  ): Promise<any> {
    const mimeType = mime.lookup(pathMedia);
    const typeMessage = mimeType.split("/")[0];

    try {
      if (!mimeType) {
        // Capturado pelo catch abaixo (loga e retorna null), como antes.
        throw new AppError("ERR_INVALID_MIMETYPE", 400);
      }
      let options: AnyMessageContent;

      if (typeMessage === "video") {
        options = {
          video: await fs.promises.readFile(pathMedia),
          caption: body ? body : '',
          fileName: fileName
          // gifPlayback: true
        };
      } else if (typeMessage === "audio") {
        const typeAudio = true; //fileName.includes("audio-record-site");
        const convert = await this.processAudio(pathMedia);
        if (typeAudio) {
          options = {
            audio: await fs.promises.readFile(convert),
            mimetype: typeAudio ? "audio/mp4" : mimeType,
            caption: body ? body : null,
            ptt: true
          };
        } else {
          options = {
            audio: await fs.promises.readFile(convert),
            mimetype: typeAudio ? "audio/mp4" : mimeType,
            caption: body ? body : null,
            ptt: true
          };
        }
        await fs.promises.unlink(convert);
      } else if (typeMessage === "document") {
        options = {
          document: await fs.promises.readFile(pathMedia),
          caption: body ? body : null,
          fileName: fileName,
          mimetype: mimeType
        };
      } else if (typeMessage === "application") {
        options = {
          document: await fs.promises.readFile(pathMedia),
          caption: body ? body : null,
          fileName: fileName,
          mimetype: mimeType
        };
      } else {
        options = {
          image: await fs.promises.readFile(pathMedia),
          caption: body ? body : null
        };
      }

      return options;
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
      return null;
    }
  }

  private async processAudio(audio: string): Promise<string> {
    const outputAudio = `${publicFolder}/${new Date().getTime()}.mp3`;
    return new Promise((resolve, reject) => {
      exec(
        `${ffmpegPath.path} -i ${audio} -vn -ab 128k -ar 44100 -f ipod ${outputAudio} -y`,
        (error, _stdout, _stderr) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(outputAudio);
        }
      );
    });
  }

  private async processAudioFile(audio: string): Promise<string> {
    const outputAudio = `${publicFolder}/${new Date().getTime()}.mp3`;
    return new Promise((resolve, reject) => {
      exec(
        `${ffmpegPath.path} -i ${audio} -vn -ar 44100 -ac 2 -b:a 192k ${outputAudio}`,
        (error, _stdout, _stderr) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(outputAudio);
        }
      );
    });
  }
}

export const whatsappMessageSender = new WhatsappMessageSender();
