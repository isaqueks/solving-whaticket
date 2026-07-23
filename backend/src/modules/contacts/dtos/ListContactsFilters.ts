import Contact from "../models/Contact";

/** Filtros de GET /contacts (antigo ListContactsService). */
export interface ListContactsFilters {
  searchParam?: string;
  pageNumber?: string;
  companyId: number;
  /** "true"/"false" — quando presente filtra por isGroup e muda o page size. */
  group?: string;
}

export interface ListContactsResult {
  contacts: Contact[];
  count: number;
  hasMore: boolean;
}
