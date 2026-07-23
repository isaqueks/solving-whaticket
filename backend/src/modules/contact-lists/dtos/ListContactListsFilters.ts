import ContactList from "../models/ContactList";

/** Filtros da listagem paginada de listas de contatos. */
export interface ListContactListsFilters {
  companyId: number | string;
  searchParam?: string;
  pageNumber?: string;
}

/** Resultado da listagem paginada (cada registro traz `contactsCount`). */
export interface ListContactListsResult {
  records: ContactList[];
  count: number;
  hasMore: boolean;
}
