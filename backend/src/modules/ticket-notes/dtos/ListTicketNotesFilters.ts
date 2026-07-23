import TicketNote from "../models/TicketNote";

/** Entrada de `TicketNotesService.list` (listagem paginada por busca textual). */
export interface ListTicketNotesFilters {
  searchParam?: string;
  /** Vem da query string; default "1" (comportamento original). */
  pageNumber?: string;
}

/** Saída de `TicketNotesService.list`. */
export interface ListTicketNotesResult {
  ticketNotes: TicketNote[];
  count: number;
  hasMore: boolean;
}
