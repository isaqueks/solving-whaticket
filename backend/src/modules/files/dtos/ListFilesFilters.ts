import Files from "../models/Files";

/**
 * Entrada de `FilesService.list` (listagem paginada da tela de listas de
 * arquivos, escopada por empresa — comportamento original do ListService).
 */
export interface ListFilesFilters {
  companyId: number;
  searchParam?: string;
  /** Vem da query string; default "1" (comportamento original). */
  pageNumber?: string | number;
}

/** Saída de `FilesService.list`. */
export interface ListFilesResult {
  files: Files[];
  count: number;
  hasMore: boolean;
}
