import QuickMessage from "../models/QuickMessage";

/** Entrada de `QuickMessagesService.list` (listagem paginada da tela). */
export interface ListQuickMessagesFilters {
  companyId: number | string;
  searchParam?: string;
  /** Vem da query string; default "1" (comportamento original). */
  pageNumber?: string;
  userId?: number | string;
}

/** Saída de `QuickMessagesService.list`. */
export interface ListQuickMessagesResult {
  records: QuickMessage[];
  count: number;
  hasMore: boolean;
}
