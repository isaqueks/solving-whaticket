import Plan from "../models/Plan";

/** Entrada da listagem paginada de planos (tela de Planos). */
export interface ListPlansFilters {
  searchParam?: string;
  pageNumber?: string;
}

/** Saída da listagem paginada (forma original do ListPlansService). */
export interface ListPlansResult {
  plans: Plan[];
  count: number;
  hasMore: boolean;
}
