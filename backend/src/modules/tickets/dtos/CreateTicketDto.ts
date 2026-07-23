/** Entrada de `TicketsService.create` (antigo CreateTicketService). */
export interface CreateTicketDto {
  contactId: number;
  status: string;
  userId: number;
  companyId: number;
  queueId?: number;
  whatsappId?: string;
}
