/**
 * Entrada de `GroupParticipantsService.list` (antigo
 * ListGroupParticipantsService + guard de empresa do controller).
 * `companyId` garante o escopo multi-tenant do contato do grupo.
 */
export interface ListGroupParticipantsFilters {
  contactId: number;
  companyId: number;
}
