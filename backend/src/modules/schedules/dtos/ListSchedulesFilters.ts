import Schedule from "../models/Schedule";

/** Entrada de `SchedulesService.list` (listagem paginada da tela de Schedules). */
export interface ListSchedulesFilters {
  companyId: number;
  searchParam?: string;
  contactId?: number | string;
  userId?: number | string;
  /** Vem da query string; default "1" (comportamento original). */
  pageNumber?: string | number;
}

/** Saída de `SchedulesService.list`. */
export interface ListSchedulesResult {
  schedules: Schedule[];
  count: number;
  hasMore: boolean;
}
