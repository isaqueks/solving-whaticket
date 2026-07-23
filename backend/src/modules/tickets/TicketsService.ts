import * as Sentry from "@sentry/node";
import { WAMessage, WASocket } from "baileys";
import { isNil } from "lodash";
import moment from "moment";

import { cacheLayer } from "../../libs/cache";
import { Store } from "../whatsapp-session/store";
// Runtime da sessão (grupo cíclico tickets ⇄ whatsapp-session): usar o
// singleton SEMPRE dentro do corpo dos métodos (binding CommonJS lazy).
import { sessionManager } from "../whatsapp-session/SessionManager";
import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { logger } from "../../utils/logger";

import Contact from "../contacts/models/Contact";
import { getContactJid } from "../contacts/getContactJid";
// O import abaixo participa do ciclo ContactsService ⇄ TicketsService — usar o
// singleton SEMPRE dentro do corpo dos métodos (binding CommonJS resolve lazy
// na chamada, nunca capturar no construtor).
import { contactsService } from "../contacts/ContactsService";
import { MessagesRepository } from "../messages/MessagesRepository";
import { QueuesRepository } from "../queues/QueuesRepository";
import { settingsService } from "../settings/SettingsService";
// Ciclo UsersService ⇄ TicketsService (users → tickets pela reatribuição no
// delete): instanciar SEMPRE dentro do corpo dos métodos, nunca no construtor.
import { UsersService } from "../users/UsersService";
import { UsersRepository } from "../users/UsersRepository";
import { whatsappService } from "../whatsapp/WhatsappService";

// Ciclo WhatsappMessageSender/MessagePersistenceService ⇄ TicketsService:
// usar os singletons SEMPRE dentro do corpo dos métodos (binding CommonJS
// resolve lazy na chamada).
import { whatsappMessageSender } from "../whatsapp-session/WhatsappMessageSender";
import { messagePersistenceService } from "../whatsapp-session/MessagePersistenceService";

import { CreateTicketDto } from "./dtos/CreateTicketDto";
import { FindOrCreateTicketTrakingDto } from "./dtos/FindOrCreateTicketTrakingDto";
import {
  ListTicketsFilters,
  ListTicketsKanbanFilters,
  ListTicketsResult
} from "./dtos/ListTicketsFilters";
import { UpdateTicketDto, UpdateTicketResult } from "./dtos/UpdateTicketDto";
import Ticket from "./models/Ticket";
import TicketTraking from "./models/TicketTraking";
import { TicketsRepository } from "./TicketsRepository";

/** Sessão wbot vinculada ao ticket (forma original do helper GetTicketWbot). */
export type TicketWbotSession = WASocket & {
  id?: number;
  store?: Store;
};

/**
 * Casos de uso do domínio Tickets (doc 04 §§2–3). Absorve os antigos
 * `services/TicketServices/` (Create/Update/Show/ShowFromUUID/Delete/List/
 * ListKanban/FindOrCreate/FindOrCreateATicketTraking) e os helpers
 * `CheckContactOpenTickets`, `GetTicketWbot` e `SetTicketMessagesAsRead`.
 * Regras de negócio preservadas linha a linha (os fluxos findOrCreate/update
 * são chamados por mensagem pelo listener do wbot); eventos de domínio
 * emitidos via RealtimeGateway (nunca `io.to` direto).
 */
export class TicketsService {
  constructor(
    private readonly repository = new TicketsRepository(),
    private readonly messagesRepository = new MessagesRepository(),
    private readonly usersRepository = new UsersRepository(),
    private readonly queuesRepository = new QueuesRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  /** Criação manual de ticket (antigo CreateTicketService). */
  public async create(dto: CreateTicketDto): Promise<Ticket> {
    const { contactId, status, queueId, companyId, whatsappId } = dto;
    let { userId } = dto;

    let whatsapp;

    if (whatsappId) {
      whatsapp = await whatsappService.show(whatsappId, companyId);
    }

    let defaultWhatsapp = await whatsappService.getDefaultWhatsAppByUser(userId);

    if (whatsapp) {
      defaultWhatsapp = whatsapp;
    }
    if (!defaultWhatsapp)
      defaultWhatsapp = await whatsappService.getDefaultWhatsApp(companyId);

    await this.checkContactOpenTickets(contactId, whatsappId);

    const { isGroup } = await contactsService.show(contactId, companyId);

    const foundTicket = await this.repository.findOrCreate(
      { contactId, companyId, whatsappId: defaultWhatsapp.id },
      { status, isGroup, userId }
    );

    const { id } = foundTicket;

    // Comportamento original preservado: o findOrCreate não carrega o contato,
    // então este bloco só teria efeito se a associação viesse populada.
    if (foundTicket.contact?.attachedToEmail) {
      const attachedUser = await this.usersRepository.findByCompanyAndEmail(
        companyId,
        foundTicket.contact.attachedToEmail
      );

      if (attachedUser) {
        userId = attachedUser.id;
      }
    }

    await this.repository.updateById(id, {
      companyId,
      queueId,
      userId,
      whatsappId: defaultWhatsapp.id,
      status: "open"
    });

    const ticket = await this.repository.findByIdWithContactAndQueue(id);

    if (!ticket) {
      throw new AppError("ERR_CREATING_TICKET");
    }

    this.realtime.emitToTicketRoom(ticket.id.toString(), SocketEvents.ticket, {
      action: "update",
      ticket
    });

    return ticket;
  }

  /**
   * Emissão extra do fluxo HTTP de criação (o antigo TicketController.store
   * emitia para as salas de status além do evento do próprio create) — só o
   * boundary HTTP usa; os demais chamadores de `create` nunca emitiram isto.
   */
  public emitTicketCreated(companyId: number, ticket: Ticket): void {
    this.realtime.emitTicketToStatusRooms(
      {
        companyId,
        status: ticket.status,
        queueId: ticket.queueId
      },
      {
        action: "update",
        ticket
      }
    );
  }

  /**
   * Atualização de ticket — o service mais crítico do sistema (aceitar/
   * transferir/fechar/reabrir; chamado também por mensagem no fluxo wbot).
   * Lógica do antigo UpdateTicketService preservada linha a linha.
   */
  public async update(dto: UpdateTicketDto): Promise<UpdateTicketResult> {
    const { ticketData, ticketId, companyId } = dto;

    try {
      const { status } = ticketData;
      let { queueId, userId, whatsappId } = ticketData;
      let chatbot: boolean | null = ticketData.chatbot || false;
      let queueOptionId: number | null = ticketData.queueOptionId || null;
      const promptId: number | null = ticketData.promptId || null;
      const useIntegration: boolean | null = ticketData.useIntegration || false;
      const integrationId: number | null = ticketData.integrationId || null;

      logger.debug({ ticketData }, "TicketsService.update: payload recebido");

      const setting = await settingsService.getByKey({
        companyId,
        key: "userRating"
      });

      const ticket = await this.show(ticketId, companyId);
      const ticketTraking = await this.findOrCreateTraking({
        ticketId,
        companyId,
        whatsappId: ticket.whatsappId
      });

      if (isNil(whatsappId)) {
        whatsappId = ticket.whatsappId.toString();
      }

      await this.setTicketMessagesAsRead(ticket);

      const oldStatus = ticket.status;
      const oldUserId = ticket.user?.id;
      const oldQueueId = ticket.queueId;

      if (ticket.contact.attachedToEmail) {
        const attachedUser = await this.usersRepository.findByCompanyAndEmail(
          companyId,
          ticket.contact.attachedToEmail
        );

        if (attachedUser) {
          userId = attachedUser.id;
        }
      }

      if (oldStatus === "closed" || Number(whatsappId) !== ticket.whatsappId) {
        await this.checkContactOpenTickets(ticket.contact.id, whatsappId);
        chatbot = null;
        queueOptionId = null;
      }

      if (status !== undefined && ["closed"].indexOf(status) > -1) {
        const { complationMessage, ratingMessage } = await whatsappService.show(
          ticket.whatsappId,
          companyId
        );

        if (setting?.value === "enabled") {
          if (ticketTraking.ratingAt == null) {
            const ratingTxt = ratingMessage || "";
            let bodyRatingMessage = `\u200e${ratingTxt}\n\n`;
            bodyRatingMessage +=
              "Digite de 1 à 3 para qualificar nosso atendimento:\n*1* - _Insatisfeito_\n*2* - _Satisfeito_\n*3* - _Muito Satisfeito_\n\n";
            await whatsappMessageSender.sendText({ body: bodyRatingMessage, ticket, userId: ticket.userId });

            await this.repository.updateTrakingInstance(ticketTraking, {
              ratingAt: moment().toDate()
            });

            this.realtime.emitTicketToStatusRooms(
              {
                companyId: ticket.companyId,
                status: "open",
                queueId: ticket.queueId,
                ticketId: ticketId.toString()
              },
              {
                action: "update",
                ticketId: ticket.id
              }
            );

            return { ticket, oldStatus, oldUserId };
          }
          ticketTraking.ratingAt = moment().toDate();
          ticketTraking.rated = false;
        }

        if (!isNil(complationMessage) && complationMessage !== "") {
          const body = `\u200e${complationMessage}`;
          await whatsappMessageSender.sendText({ body, ticket, userId: ticket.userId });
        }
        await this.repository.updateInstance(ticket, {
          promptId,
          integrationId,
          useIntegration,
          typebotStatus: useIntegration ? undefined : false,
          typebotSessionId: useIntegration ? undefined : null
        });

        ticketTraking.finishedAt = moment().toDate();
        ticketTraking.whatsappId = ticket.whatsappId;
        ticketTraking.userId = ticket.userId;
      }

      if (queueId !== undefined && queueId !== null) {
        ticketTraking.queuedAt = moment().toDate();
      }

      const settingsTransfTicket = await settingsService.getByKey({
        companyId,
        key: "sendMsgTransfTicket"
      });

      if (settingsTransfTicket?.value === "enabled") {
        // Mensagem de transferencia da FILA
        if (oldQueueId !== queueId && oldUserId === userId && !isNil(oldQueueId) && !isNil(queueId)) {

          const queue = await this.queuesRepository.findById(queueId);
          const wbot = await this.getTicketWbot(ticket);
          const msgtxt = "*Mensagem automática*:\nVocê foi transferido para o departamento *" + queue?.name + "*\naguarde, já vamos te atender!";

          const queueChangedMessage = await wbot.sendMessage(getContactJid(ticket.contact),
            {
              text: msgtxt
            }
          );
          await messagePersistenceService.verifyMessage(queueChangedMessage, ticket, ticket.contact);
        }
        else
          // Mensagem de transferencia do ATENDENTE
          if (oldUserId !== userId && oldQueueId === queueId && !isNil(oldUserId) && !isNil(userId)) {
            const wbot = await this.getTicketWbot(ticket);
            const nome = await new UsersService().show(ticketData.userId);
            const msgtxt = "*Mensagem automática*:\nFoi transferido para o atendente *" + nome.name + "*\naguarde, já vamos te atender!";

            const queueChangedMessage = await wbot.sendMessage(getContactJid(ticket.contact),
              {
                text: msgtxt
              }
            );
            await messagePersistenceService.verifyMessage(queueChangedMessage, ticket, ticket.contact);
          }
          else
            // Mensagem de transferencia do ATENDENTE e da FILA
            if (oldUserId !== userId && !isNil(oldUserId) && !isNil(userId) && oldQueueId !== queueId && !isNil(oldQueueId) && !isNil(queueId)) {
              const wbot = await this.getTicketWbot(ticket);
              const queue = await this.queuesRepository.findById(queueId);
              const nome = await new UsersService().show(ticketData.userId);
              const msgtxt = "*Mensagem automática*:\nVocê foi transferido para o departamento *" + queue?.name + "* e contará com a presença de *" + nome.name + "*\naguarde, já vamos te atender!";

              const queueChangedMessage = await wbot.sendMessage(getContactJid(ticket.contact),
                {
                  text: msgtxt
                }
              );
              await messagePersistenceService.verifyMessage(queueChangedMessage, ticket, ticket.contact);
            } else
              if (oldUserId !== undefined && isNil(userId) && oldQueueId !== queueId && !isNil(queueId)) {

                const queue = await this.queuesRepository.findById(queueId);
                const wbot = await this.getTicketWbot(ticket);
                const msgtxt = "*Mensagem automática*:\nVocê foi transferido para o departamento *" + queue?.name + "*\naguarde, já vamos te atender!";

                const queueChangedMessage = await wbot.sendMessage(getContactJid(ticket.contact),
                  {
                    text: msgtxt
                  }
                );
                await messagePersistenceService.verifyMessage(queueChangedMessage, ticket, ticket.contact);
              }
      }

      await this.repository.updateInstance(ticket, {
        status,
        queueId,
        userId,
        whatsappId,
        chatbot,
        queueOptionId
      });

      await this.repository.reloadWithContactAndTags(ticket);

      if (status !== undefined && ["pending"].indexOf(status) > -1) {
        // Disparo sem await preservado do fluxo original (o save abaixo persiste).
        this.repository.updateTrakingInstance(ticketTraking, {
          whatsappId,
          queuedAt: moment().toDate(),
          startedAt: null,
          userId: null
        });
      }

      if (status !== undefined && ["open"].indexOf(status) > -1) {
        // Disparo sem await preservado do fluxo original (o save abaixo persiste).
        this.repository.updateTrakingInstance(ticketTraking, {
          startedAt: moment().toDate(),
          ratingAt: null,
          rated: false,
          whatsappId,
          userId: ticket.userId
        });
      }

      await this.repository.saveTraking(ticketTraking);

      if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId) {
        this.realtime.emitTicketToStatusRooms(
          {
            companyId,
            status: oldStatus,
            queueId: ticket.queueId,
            userId: oldUserId
          },
          {
            action: "update",
            ticket
          }
        );
      }

      this.realtime.emitTicketChanged(
        {
          companyId,
          status: ticket.status,
          queueId: ticket.queueId,
          ticketId: +ticketId,
          payload: {
            action: "update",
            ticket
          }
        },
        [ticket?.userId, oldUserId]
      );

      return { ticket, oldStatus, oldUserId };
    } catch (err) {
      logger.error({ err }, "Falha ao atualizar o ticket %s", ticketId);
      Sentry.captureException(err);
      throw err;
    }
  }

  /** Leitura detalhada com checagem de empresa (antigo ShowTicketService). */
  public async show(id: string | number, companyId: number): Promise<Ticket> {
    const ticket = await this.repository.findByIdWithDetails(id);

    if (!ticket) {
      throw new AppError("ERR_NO_TICKET_FOUND", 404);
    }

    if (ticket.companyId !== companyId) {
      throw new AppError("Não é possível consultar registros de outra empresa");
    }

    return ticket;
  }

  /** Leitura por uuid (antigo ShowTicketFromUUIDService — sem checar empresa). */
  public async showFromUUID(uuid: string): Promise<Ticket> {
    const ticket = await this.repository.findByUuidWithDetails(uuid);

    if (!ticket) {
      throw new AppError("ERR_NO_TICKET_FOUND", 404);
    }

    return ticket;
  }

  /**
   * Exclusão de ticket: valida o acesso (show), apaga e emite o delete para o
   * conjunto padrão de salas (fluxo original do controller + DeleteTicketService).
   */
  public async remove(ticketId: string, companyId: number): Promise<Ticket> {
    await this.show(ticketId, companyId);

    const ticket = await this.repository.findById(ticketId);

    if (!ticket) {
      throw new AppError("ERR_NO_TICKET_FOUND", 404);
    }

    await this.repository.destroy(ticket);

    this.realtime.emitTicketChanged({
      companyId,
      status: ticket.status,
      queueId: ticket.queueId,
      ticketId: +ticketId,
      payload: {
        action: "delete",
        ticketId: +ticketId
      }
    });

    return ticket;
  }

  /** Listagem principal (antigo ListTicketsService). */
  public async list(filters: ListTicketsFilters): Promise<ListTicketsResult> {
    const { searchParam = "", pageNumber = "1", ...rest } = filters;

    const userQueueIds = await this.resolveUnreadQueueIds(
      rest.withUnreadMessages,
      rest.userId
    );

    return this.repository.findAndCountForList({
      ...rest,
      searchParam,
      pageNumber,
      userQueueIds
    });
  }

  /** Listagem do kanban (antigo ListTicketsServiceKanban). */
  public async listKanban(
    filters: ListTicketsKanbanFilters
  ): Promise<ListTicketsResult> {
    const { searchParam = "", pageNumber = "1", ...rest } = filters;

    const userQueueIds = await this.resolveUnreadQueueIds(
      rest.withUnreadMessages,
      rest.userId
    );

    return this.repository.findAndCountForKanban({
      ...rest,
      searchParam,
      pageNumber,
      userQueueIds
    });
  }

  /**
   * Localiza (reabrindo se preciso) ou cria o ticket de uma conversa — CAMINHO
   * QUENTE chamado por mensagem pelo listener do wbot (antigo
   * FindOrCreateTicketService, preservado linha a linha).
   */
  public async findOrCreate(
    contact: Contact,
    whatsappId: number,
    unreadMessages: number,
    companyId: number,
    groupContact?: Contact
  ): Promise<Ticket> {
    let ticket = await this.repository.findLatestByContactAndWhatsapp(
      groupContact ? groupContact.id : contact.id,
      companyId,
      whatsappId
    );

    if (ticket) {
      await this.repository.updateInstance(ticket, { unreadMessages, whatsappId });
    }

    if (ticket?.status === "closed") {
      await this.repository.updateInstance(ticket, {
        status: "pending",
        userId: null,
        queueId: null,
        unreadMessages,
        companyId
      });
      await this.findOrCreateTraking({
        ticketId: ticket.id,
        companyId,
        whatsappId: ticket.whatsappId,
        userId: ticket.userId
      });
    }

    if (!ticket && groupContact) {
      ticket = await this.repository.findLatestByContact(groupContact.id);

      if (ticket) {
        await this.repository.updateInstance(ticket, {
          status: "pending",
          userId: null,
          unreadMessages,
          queueId: null,
          companyId
        });
        await this.findOrCreateTraking({
          ticketId: ticket.id,
          companyId,
          whatsappId: ticket.whatsappId,
          userId: ticket.userId
        });
      }
    }

    if (!ticket && !groupContact) {
      ticket = await this.repository.findRecentByContact(contact.id);

      if (ticket) {
        await this.repository.updateInstance(ticket, {
          status: "pending",
          userId: null,
          unreadMessages,
          queueId: null,
          companyId
        });
        await this.findOrCreateTraking({
          ticketId: ticket.id,
          companyId,
          whatsappId: ticket.whatsappId,
          userId: ticket.userId
        });
      }
    }

    const whatsapp = await whatsappService.findByIdWithoutSession(whatsappId);

    if (!ticket) {
      ticket = await this.repository.create({
        contactId: groupContact ? groupContact.id : contact.id,
        status: "pending",
        isGroup: !!groupContact,
        unreadMessages,
        whatsappId,
        whatsapp,
        companyId
      });
      await this.findOrCreateTraking({
        ticketId: ticket.id,
        companyId,
        whatsappId,
        userId: ticket.userId
      });
    }

    ticket = await this.show(ticket.id, companyId);

    return ticket;
  }

  /**
   * Traking em aberto do ticket, criando um novo se não houver (antigo
   * FindOrCreateATicketTrakingService — também caminho quente do wbot).
   */
  public async findOrCreateTraking(
    dto: FindOrCreateTicketTrakingDto
  ): Promise<TicketTraking> {
    const { ticketId, companyId, whatsappId, userId } = dto;

    const ticketTraking = await this.repository.findOpenTraking(ticketId);

    if (ticketTraking) {
      return ticketTraking;
    }

    return this.repository.createTraking({
      ticketId,
      companyId,
      whatsappId,
      userId
    });
  }

  /**
   * Zera os não-lidos do ticket, marca as mensagens como lidas no banco e no
   * WhatsApp e notifica o mainchannel (antigo helper SetTicketMessagesAsRead).
   */
  public async setTicketMessagesAsRead(ticket: Ticket): Promise<void> {
    await this.repository.updateInstance(ticket, { unreadMessages: 0 });
    const REDIS_KEY = `contacts:${ticket.contactId}:unreads`;

    await cacheLayer.set(REDIS_KEY, "0");

    try {
      const wbot = await this.getTicketWbot(ticket);

      const getJsonMessage = await this.messagesRepository.findUnreadIncomingByTicket(
        ticket.id
      );

      if (getJsonMessage.length > 0) {
        const lastMessages: WAMessage = JSON.parse(
          JSON.stringify(getJsonMessage[0].dataJson)
        );

        if (lastMessages.key && lastMessages.key.fromMe === false) {
          await (wbot as WASocket).chatModify(
            { markRead: true, lastMessages: [lastMessages] },
            `${ticket.contact.number}@${
              ticket.isGroup ? "g.us" : "s.whatsapp.net"
            }`
          );
        }
      }

      await this.messagesRepository.markAllAsReadByTicket(ticket.id);
    } catch (err) {
      logger.warn(
        `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${err}`
      );
    }

    this.realtime.emitTicketToMainChannel(ticket.companyId, {
      action: "updateUnread",
      ticketId: ticket.id
    });
  }

  /** Sessão wbot da conexão do ticket (antigo helper GetTicketWbot). */
  public async getTicketWbot(ticket: Ticket): Promise<TicketWbotSession> {
    if (!ticket.whatsappId) {
      const defaultWhatsapp = await whatsappService.getDefaultWhatsApp(
        ticket.user.id
      );

      await this.repository.setWhatsapp(ticket, defaultWhatsapp);
    }

    const wbot = sessionManager.getWbot(ticket.whatsappId);
    return wbot;
  }

  /** Tickets abertos de um usuário (reatribuição no delete — módulo users). */
  public async findOpenByUser(userId: number): Promise<Ticket[]> {
    return this.repository.findOpenByUserId(userId);
  }

  /**
   * Garante que o contato não tem outro ticket aberto/pendente (na conexão,
   * quando informada) — antigo helper CheckContactOpenTickets.
   */
  private async checkContactOpenTickets(
    contactId: number,
    whatsappId?: string
  ): Promise<void> {
    const ticket = await this.repository.findOpenOrPendingByContact(
      contactId,
      whatsappId
    );

    if (ticket) {
      throw new AppError("ERR_OTHER_OPEN_TICKET");
    }
  }

  /** Filas do usuário para o ramo withUnreadMessages das listagens. */
  private async resolveUnreadQueueIds(
    withUnreadMessages: string | undefined,
    userId: string
  ): Promise<number[] | undefined> {
    if (withUnreadMessages !== "true") {
      return undefined;
    }

    const user = await new UsersService().show(userId);
    return user.queues.map(queue => queue.id);
  }
}

/**
 * Instância compartilhada para chamadores de fora do módulo (wbot, users,
 * contacts, messages, jobs). IMPORTANTE: usar sempre dentro do corpo de
 * funções — nunca em escopo de módulo — por causa dos ciclos
 * ContactsService/UsersService/SendWhatsAppMessage ⇄ TicketsService
 * (bindings CommonJS resolvem lazy na chamada).
 */
export const ticketsService = new TicketsService();
