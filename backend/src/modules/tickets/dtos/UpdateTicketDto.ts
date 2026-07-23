import Ticket from "../models/Ticket";

/** Campos mutáveis do ticket (antigo `TicketData` do UpdateTicketService). */
export interface UpdateTicketData {
  status?: string;
  userId?: number | null;
  queueId?: number | null;
  chatbot?: boolean;
  queueOptionId?: number;
  whatsappId?: string;
  useIntegration?: boolean;
  integrationId?: number | null;
  promptId?: number | null;
}

/** Entrada de `TicketsService.update` (antigo Request do UpdateTicketService). */
export interface UpdateTicketDto {
  ticketData: UpdateTicketData;
  ticketId: string | number;
  companyId: number;
}

/** Saída de `TicketsService.update` (forma original preservada). */
export interface UpdateTicketResult {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}
