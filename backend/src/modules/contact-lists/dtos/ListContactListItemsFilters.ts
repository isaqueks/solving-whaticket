import ContactListItem from "../models/ContactListItem";

/** Filtros da listagem paginada de itens de uma lista. */
export interface ListContactListItemsFilters {
  companyId: number | string;
  contactListId: number | string;
  searchParam?: string;
  pageNumber?: string;
}

/** Resultado da listagem paginada de itens. */
export interface ListContactListItemsResult {
  contacts: ContactListItem[];
  count: number;
  hasMore: boolean;
}
