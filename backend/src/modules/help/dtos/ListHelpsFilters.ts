import Help from "../models/Help";

/**
 * Entrada de `HelpService.list` (listagem paginada da tela de Ajuda).
 * Help é recurso global (sem escopo de empresa) — não há `companyId` aqui,
 * como no ListService original.
 */
export interface ListHelpsFilters {
  searchParam?: string;
  /** Vem da query string; default "1" (comportamento original). */
  pageNumber?: string | number;
}

/** Saída de `HelpService.list`. */
export interface ListHelpsResult {
  records: Help[];
  count: number;
  hasMore: boolean;
}
