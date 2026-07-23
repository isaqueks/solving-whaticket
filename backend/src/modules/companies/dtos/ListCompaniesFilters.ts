import Company from "../models/Company";

/** Entrada da listagem paginada de empresas (tela de Empresas). */
export interface ListCompaniesFilters {
  searchParam?: string;
  pageNumber?: string;
}

/** Saída da listagem paginada (forma original do ListCompaniesService). */
export interface ListCompaniesResult {
  companies: Company[];
  count: number;
  hasMore: boolean;
}
