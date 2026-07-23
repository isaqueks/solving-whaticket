import Ticket from "../../tickets/models/Ticket";
import Message from "../models/Message";

/** Filtros de `MessagesService.list` (antigo ListMessagesService). */
export interface ListMessagesFilters {
  ticketId: string;
  companyId: number;
  pageNumber?: string;
  queues?: number[];
}

/** Entrada do caso de uso HTTP (GET /messages/:ticketId). */
export interface ListMessagesRequest {
  ticketId: string;
  companyId: number;
  pageNumber?: string;
  profile: string;
  userId: string;
}

export interface ListMessagesResult {
  messages: Message[];
  ticket: Ticket;
  count: number;
  hasMore: boolean;
}
