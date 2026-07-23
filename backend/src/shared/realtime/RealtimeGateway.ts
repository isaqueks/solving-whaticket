import { Server as SocketIO } from "socket.io";

import { getIO } from "../../libs/socket";
import { SocketEvents } from "./events";
import { Rooms } from "./rooms";

/**
 * Mudança de ticket destinada ao conjunto padrão de salas
 * (status da empresa + notificação da empresa + status da fila +
 * notificação da fila + sala do ticket).
 */
export interface TicketChange {
  companyId: number;
  status: string;
  queueId: number | null;
  ticketId: number;
  payload: unknown;
}

/**
 * Subconjunto de salas de status (empresa + fila), com sala do ticket e sala
 * de usuário opcionais — cobre as emissões parciais do domínio de tickets
 * (ex.: pedido de avaliação, criação pelo controller, salas do status antigo).
 */
export interface TicketStatusRoomsSelector {
  companyId: number;
  status: string;
  queueId: number | null;
  /** Quando presente, também emite para a sala do ticket. */
  ticketId?: number | string;
  /** Quando presente, também emite para a sala individual do usuário. */
  userId?: number;
}

/**
 * Fachada única de emissão de socket (doc 04 §7): services emitem por aqui,
 * nunca com `getIO().to(...).emit(...)` montando strings à mão.
 *
 * Os call sites de `io.to()` migram para cá junto com seus módulos (fases
 * B0–B6; na B5 o runtime wbot inteiro passou a emitir por aqui). Salas,
 * eventos e payloads emitidos são IDÊNTICOS aos anteriores.
 */
export class RealtimeGateway {
  constructor(private readonly resolveServer: () => SocketIO = getIO) {}

  /** Emite um evento qualquer para a sala individual de um usuário. */
  public emitToUser(userId: number, event: string, payload: unknown): void {
    this.resolveServer()
      .to(Rooms.user(userId))
      .emit(event, payload);
  }

  /** Emite um evento qualquer para o canal principal da empresa. */
  public emitToMainChannel(
    companyId: number,
    event: string,
    payload: unknown
  ): void {
    this.resolveServer()
      .to(Rooms.mainChannel(companyId))
      .emit(event, payload);
  }

  /**
   * Mudança de ticket visível apenas no mainchannel da empresa
   * (ex.: `action: "updateUnread"`).
   */
  public emitTicketToMainChannel(companyId: number, payload: unknown): void {
    this.emitToMainChannel(
      companyId,
      SocketEvents.companyTicket(companyId),
      payload
    );
  }

  /**
   * Mudança de ticket para o conjunto padrão de salas. `userIds` adiciona as
   * salas individuais dos usuários informados (ex.: atendente novo e antigo na
   * transferência) — valores `undefined` produzem a sala "user-undefined",
   * sem ouvintes, exatamente como as emissões originais.
   */
  public emitTicketChanged(
    change: TicketChange,
    userIds: Array<number | undefined> = []
  ): void {
    const { companyId, status, queueId, ticketId, payload } = change;

    let target = this.resolveServer()
      .to(Rooms.companyStatus(companyId, status))
      .to(Rooms.companyNotification(companyId))
      .to(Rooms.queueStatus(queueId, status))
      .to(Rooms.queueNotification(queueId))
      .to(Rooms.ticket(ticketId));

    for (const userId of userIds) {
      target = target.to(Rooms.user(userId as number));
    }

    target.emit(SocketEvents.companyTicket(companyId), payload);
  }

  /**
   * Mudança de ticket para as salas de STATUS (empresa + fila), com sala do
   * ticket e/ou do usuário opcionais — emissões parciais do domínio tickets.
   */
  public emitTicketToStatusRooms(
    selector: TicketStatusRoomsSelector,
    payload: unknown
  ): void {
    const { companyId, status, queueId, ticketId, userId } = selector;

    let target = this.resolveServer()
      .to(Rooms.companyStatus(companyId, status))
      .to(Rooms.queueStatus(queueId, status));

    if (ticketId !== undefined) {
      target = target.to(Rooms.ticket(ticketId));
    }
    if (userId !== undefined) {
      target = target.to(Rooms.user(userId));
    }

    target.emit(SocketEvents.companyTicket(companyId), payload);
  }

  /**
   * Mudança de ticket para a sala legada "open" (sem escopo de empresa) —
   * emissões históricas dos jobs de vínculo/fechamento automático. Sala e
   * evento idênticos aos anteriores (ver nota em `Rooms.legacyOpen`).
   */
  public emitTicketToLegacyOpenRoom(
    companyId: number,
    payload: unknown
  ): void {
    this.resolveServer()
      .to(Rooms.legacyOpen)
      .emit(SocketEvents.companyTicket(companyId), payload);
  }

  /** Emite um evento qualquer para a sala do ticket (nome = id do ticket). */
  public emitToTicketRoom(
    ticketId: number | string,
    event: string,
    payload: unknown
  ): void {
    this.resolveServer()
      .to(Rooms.ticket(ticketId))
      .emit(event, payload);
  }

  /** Mensagem de app (appMessage) para o conjunto padrão de salas do ticket. */
  public emitAppMessageChanged(change: TicketChange): void {
    const { companyId, status, queueId, ticketId, payload } = change;

    this.resolveServer()
      .to(Rooms.ticket(ticketId))
      .to(Rooms.companyStatus(companyId, status))
      .to(Rooms.companyNotification(companyId))
      .to(Rooms.queueStatus(queueId, status))
      .to(Rooms.queueNotification(queueId))
      .emit(SocketEvents.companyAppMessage(companyId), payload);
  }

  /** Mensagem de app (appMessage) apenas para a sala do ticket. */
  public emitAppMessageToTicketRoom(
    companyId: number,
    ticketId: number | string,
    payload: unknown
  ): void {
    this.emitToTicketRoom(
      ticketId,
      SocketEvents.companyAppMessage(companyId),
      payload
    );
  }
}

export const realtimeGateway = new RealtimeGateway();
