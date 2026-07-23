/**
 * Entrada de `TicketNotesService.findByContactAndTicket`: notas de um contato
 * dentro de um ticket (usado pela tela de observações do ticket).
 */
export interface FindNotesFilters {
  contactId: number | string;
  ticketId: number | string;
}
