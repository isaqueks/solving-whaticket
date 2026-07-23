/**
 * Entrada de `TagsService.linkTag`: vincula uma tag a um ticket na tabela de
 * junção TicketTag. Os ids chegam como string (params da rota) — o Sequelize
 * coage ao inserir, comportamento preservado do TicketTagController original.
 */
export interface LinkTicketTagDto {
  ticketId: string;
  tagId: string;
}
