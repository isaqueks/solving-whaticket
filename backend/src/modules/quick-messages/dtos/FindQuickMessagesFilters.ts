/**
 * Entrada de `QuickMessagesService.find` (lista plana por empresa+usuário,
 * usada por selects — endpoint `/quick-messages/list`).
 */
export interface FindQuickMessagesFilters {
  companyId: string;
  userId: string;
}
