import { proto } from "baileys";

import formatBody from "../../shared/helpers/Mustache";
import { messageQueue } from "../../queues/connection";
import AppError from "../../shared/errors/AppError";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { logger } from "../../utils/logger";

import { ContactsRepository } from "../contacts/ContactsRepository";
import { getContactJid } from "../contacts/getContactJid";
import { getBrazilianNumberVariations } from "../contacts/OnWhatsappNumberResolver";
// Ciclo ContactsService ⇄ (tickets ⇄ wbot) ⇄ MessagesService: usar o
// singleton SEMPRE dentro do corpo dos métodos (binding CommonJS lazy).
import { contactsService } from "../contacts/ContactsService";
import Ticket from "../tickets/models/Ticket";
// Ciclo TicketsService ⇄ wbotMessagePersistence ⇄ MessagesService: usar o
// singleton SEMPRE dentro do corpo dos métodos, nunca no construtor.
import { ticketsService } from "../tickets/TicketsService";
// Idem para UsersService (participa do grupo cíclico users ⇄ tickets):
// instanciar apenas dentro do corpo dos métodos.
import { UsersService } from "../users/UsersService";
import { whatsappService } from "../whatsapp/WhatsappService";

// Runtime da sessão wbot (módulo whatsapp-session) — singletons usados apenas
// em tempo de chamada, seguros para os ciclos com este módulo (binding
// CommonJS resolve lazy na chamada).
import { contactValidator } from "../whatsapp-session/ContactValidator";
import { profilePicService } from "../whatsapp-session/ProfilePicService";
import { sessionManager } from "../whatsapp-session/SessionManager";
import { whatsappMessageSender } from "../whatsapp-session/WhatsappMessageSender";

import { CreateMessageDto } from "./dtos/CreateMessageDto";
import { ForwardMessagesDto } from "./dtos/ForwardMessagesDto";
import {
  ListMessagesFilters,
  ListMessagesRequest,
  ListMessagesResult
} from "./dtos/ListMessagesFilters";
import { SendApiMessageDto } from "./dtos/SendApiMessageDto";
import { SendTicketMessageDto } from "./dtos/SendTicketMessageDto";
import {
  SendPublicMessageDto,
  SendPublicMessageResult
} from "./dtos/SendPublicMessageDto";
import Message from "./models/Message";
import { MessagesRepository } from "./MessagesRepository";

/** Página fixa da listagem de mensagens (comportamento original). */
const LIST_PAGE_SIZE = 22;

/**
 * Casos de uso do domínio Messages (doc 04 §§2–3). Absorve o antigo
 * `services/MessageServices/` (Create/Get/List), o helper `GetWbotMessage` e a
 * lógica dos controllers gordos (MessageController/PublicMessageController).
 * `create` é caminho quente chamado por mensagem pelo wbot — lógica preservada
 * linha a linha; eventos via RealtimeGateway (nunca `io.to` direto).
 */
export class MessagesService {
  constructor(
    private readonly repository = new MessagesRepository(),
    private readonly contactsRepository = new ContactsRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  /** Persiste (upsert) uma mensagem e emite o evento — antigo CreateMessageService. */
  public async create(dto: CreateMessageDto): Promise<Message> {
    const { messageData, companyId } = dto;

    await this.repository.upsert({ ...messageData, companyId });

    const message = await this.repository.findByIdWithRelations(messageData.id);

    // Ordem original preservada: o acesso a message.ticket antecede o guard de
    // nulo (uma mensagem inexistente estoura aqui, como sempre estourou).
    if (message.ticket.queueId !== null && message.queueId === null) {
      await this.repository.updateInstance(message, {
        queueId: message.ticket.queueId
      });
    }

    if (!message) {
      throw new AppError("ERR_CREATING_MESSAGE", 500);
    }

    this.realtime.emitAppMessageChanged({
      companyId,
      status: message.ticket.status,
      queueId: message.ticket.queueId,
      ticketId: message.ticketId,
      payload: {
        action: "create",
        message,
        ticket: message.ticket,
        contact: message.ticket.contact
      }
    });

    return message;
  }

  /** Página de mensagens do ticket (antigo ListMessagesService). */
  public async list(filters: ListMessagesFilters): Promise<ListMessagesResult> {
    const { pageNumber = "1", ticketId, companyId, queues = [] } = filters;

    const ticket = await ticketsService.show(ticketId, companyId);

    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { count, messages } = await this.repository.findAndCountByTicket({
      ticketId,
      companyId,
      queues,
      limit,
      offset
    });

    const hasMore = count > offset + messages.length;

    return {
      messages: messages.reverse(),
      ticket,
      count,
      hasMore
    };
  }

  /**
   * Caso de uso do GET /messages/:ticketId: restringe às filas do usuário
   * quando não é admin (lógica movida do controller) e dispara a marcação de
   * leitura sem aguardar (comportamento original).
   */
  public async listForRequest(
    request: ListMessagesRequest
  ): Promise<ListMessagesResult> {
    const { ticketId, companyId, pageNumber, profile, userId } = request;

    const queues: number[] = [];

    if (profile !== "admin") {
      const user = await new UsersService().show(userId);
      user.queues.forEach(queue => {
        queues.push(queue.id);
      });
    }

    const result = await this.list({ pageNumber, ticketId, companyId, queues });

    // Disparo sem await preservado do controller original.
    ticketsService.setTicketMessagesAsRead(result.ticket);

    return result;
  }

  /** Envio a partir de um ticket aberto na tela (antigo MessageController.store). */
  public async sendTicketMessage(dto: SendTicketMessageDto): Promise<void> {
    const { ticketId, companyId, userId, body, quotedMsg, editMsg, medias } = dto;

    const ticket = await ticketsService.show(ticketId, companyId);

    // Disparo sem await preservado do controller original.
    ticketsService.setTicketMessagesAsRead(ticket);

    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File, index) => {
          await whatsappMessageSender.sendMedia({
            media,
            ticket,
            body: Array.isArray(body) ? body[index] : body
          });
        })
      );
      return;
    }

    await whatsappMessageSender.sendText({ body, ticket, quotedMsg, editMsg, userId });
  }

  /** Encaminhamento de mensagens (antigo MessageController.forward). */
  public async forward(dto: ForwardMessagesDto): Promise<void> {
    const { contactId, whatsappId, messagesId } = dto;

    await whatsappMessageSender.forward({
      contactId,
      whatsappId,
      messagesId
    });
  }

  /** Apaga a mensagem no WhatsApp e emite o update (antigo MessageController.remove). */
  public async delete(messageId: string, companyId: number): Promise<Message> {
    const message = await whatsappMessageSender.delete(messageId);

    this.realtime.emitAppMessageToTicketRoom(companyId, message.ticketId, {
      action: "update",
      message
    });

    return message;
  }

  /**
   * Envio pela API externa (POST /api/messages/send, antigo
   * MessageController.send): valida a conexão/número, cria-atualiza o contato,
   * localiza/cria o ticket e envia direto (texto) ou via fila Bull (mídia).
   */
  public async sendApiMessage(dto: SendApiMessageDto): Promise<void> {
    const { whatsappId, messageData, medias, requestUser } = dto;

    try {
      const whatsapp = await whatsappService.findByIdWithoutSession(whatsappId);

      if (!whatsapp) {
        // Antes: Error("Não foi possível realizar a operação") → 500 genérico.
        throw new AppError("ERR_WAPP_NOT_FOUND", 404);
      }

      if (messageData.number === undefined) {
        // Antes: Error("O número é obrigatório") → 500 genérico.
        throw new AppError("ERR_NUMBER_REQUIRED", 400);
      }

      const numberToTest = messageData.number;
      const { body } = messageData;

      const { companyId } = whatsapp;

      const checkValidNumber = await contactValidator.checkNumber(numberToTest, companyId);
      const number = checkValidNumber.jid.replace(/[^0-9|-]/g, "");
      const profilePicUrl = await profilePicService.getProfilePicUrl(number, companyId);
      const contactData = {
        name: `${number}`,
        number,
        profilePicUrl,
        isGroup: false,
        companyId
      };

      const contact = await contactsService.createOrUpdate(contactData);

      const ticket = await ticketsService.findOrCreate(
        contact,
        whatsapp.id!,
        0,
        companyId
      );

      if (medias) {
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            await messageQueue.add(
              "SendMessage",
              {
                whatsappId,
                data: {
                  number,
                  body: body ? formatBody(body, contact) : media.originalname,
                  mediaPath: media.path,
                  fileName: media.originalname
                }
              },
              { removeOnComplete: true, attempts: 3 }
            );
          })
        );
      } else {
        // `requestUser` é undefined nesta rota (tokenAuth não popula req.user):
        // o acesso a `.id` estoura aqui e cai no catch — ERR_SENDING_WAPP_MSG,
        // exatamente como o controller original.
        await whatsappMessageSender.sendText({
          body: formatBody(body, contact),
          ticket,
          userId: +requestUser.id
        });
      }

      if (messageData.closeTicket) {
        setTimeout(async () => {
          await ticketsService.update({
            ticketId: ticket.id,
            ticketData: { status: "closed" },
            companyId
          });
        }, 1000);
      }

      // Disparo sem await preservado do controller original.
      ticketsService.setTicketMessagesAsRead(ticket);
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      logger.error(err);
      throw new AppError("ERR_SENDING_WAPP_MSG", 500);
    }
  }

  /**
   * Envio público por número (antigo PublicMessageController.sendByNumber):
   * localiza o contato por variações BR do número (sem escopo de empresa —
   * comportamento original) e envia pela conexão padrão da empresa dele.
   */
  public async sendByNumber(
    dto: SendPublicMessageDto
  ): Promise<SendPublicMessageResult> {
    const { to, content } = dto;

    if (!content) {
      throw new AppError("O campo 'content' é obrigatório", 400);
    }

    if (!to) {
      throw new AppError("O campo 'to' é obrigatório", 400);
    }

    // Normaliza o número (remove caracteres não numéricos)
    const normalizedNumber = to.replace(/\D/g, "");

    // Gera variações do número brasileiro (com/sem 9)
    const numberVariations = getBrazilianNumberVariations(normalizedNumber);

    const contact = await this.contactsRepository.findByAnyNumber(
      numberVariations
    );

    if (!contact) {
      throw new AppError(`Contato com número '${to}' não encontrado`, 404);
    }

    // Busca a conexão WhatsApp padrão da empresa do contato
    const whatsapp = await whatsappService.getDefaultWhatsApp(contact.companyId);

    if (!whatsapp) {
      throw new AppError("Nenhuma conexão WhatsApp disponível", 500);
    }

    const wbot = sessionManager.getWbot(whatsapp.id);

    await wbot.sendMessage(getContactJid(contact), { text: content });

    return {
      contactId: contact.id,
      contactName: contact.name
    };
  }

  /** Mensagem por id, lançando MESSAGE_NOT_FIND (antigo GetMessagesService). */
  public async getById(id: string): Promise<Message> {
    const messageExists = await this.repository.findById(id);

    if (!messageExists) {
      throw new AppError("MESSAGE_NOT_FIND");
    }

    return messageExists;
  }

  /**
   * Mensagem do WhatsApp vinculada ao ticket (antigo helper GetWbotMessage) —
   * qualquer falha é padronizada em ERR_FETCH_WAPP_MSG, como no original.
   */
  public async getWbotMessage(
    ticket: Ticket,
    messageId: string
  ): Promise<proto.WebMessageInfo | Message> {
    try {
      const msgFound = await this.getById(messageId);

      if (!msgFound) {
        // Engolido pelo catch abaixo, que padroniza em ERR_FETCH_WAPP_MSG.
        throw new AppError("ERR_FETCH_WAPP_MSG", 404);
      }

      return msgFound;
    } catch (err) {
      throw new AppError("ERR_FETCH_WAPP_MSG");
    }
  }
}

/**
 * Instância compartilhada para chamadores de fora do módulo (persistência do
 * wbot, monitor, tickets). IMPORTANTE: usar sempre dentro do corpo de funções
 * — nunca em escopo de módulo — por causa dos ciclos com TicketsService e o
 * módulo whatsapp-session (bindings CommonJS resolvem lazy na chamada).
 */
export const messagesService = new MessagesService();
