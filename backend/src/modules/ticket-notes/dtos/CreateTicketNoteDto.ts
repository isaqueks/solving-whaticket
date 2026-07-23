/**
 * Entrada de `TicketNotesService.create` (doc 04 §4).
 * `userId` vem do usuário autenticado (`req.user`); `contactId`/`ticketId` são
 * opcionais (podem chegar como 0 quando a observação não está vinculada).
 */
export interface CreateTicketNoteDto {
  note: string;
  userId: number | string;
  contactId?: number | string;
  ticketId?: number | string;
}
