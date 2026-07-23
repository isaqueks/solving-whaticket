import Tag from "../models/Tag";

/** Entrada de `TagsService.list` (listagem paginada da tela de Tags). */
export interface ListTagsFilters {
  companyId: number;
  searchParam?: string;
  /** Vem da query string; default "1" (comportamento original). */
  pageNumber?: string | number;
}

/** Saída de `TagsService.list`. */
export interface ListTagsResult {
  tags: Tag[];
  count: number;
  hasMore: boolean;
}
