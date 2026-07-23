/** Entrada de `TicketsService.findOrCreateTraking` (antigo FindOrCreateATicketTrakingService). */
export interface FindOrCreateTicketTrakingDto {
  ticketId: string | number;
  companyId: string | number;
  whatsappId?: string | number;
  userId?: string | number;
}
