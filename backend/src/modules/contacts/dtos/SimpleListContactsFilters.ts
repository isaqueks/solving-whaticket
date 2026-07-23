/** Filtros de GET /contacts/list (antigo `SearchContactParams`). */
export interface SimpleListContactsFilters {
  companyId: string | number;
  name?: string;
}
