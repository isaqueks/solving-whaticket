import Campaign from "../models/Campaign";

/** Filtros da listagem paginada de campanhas (antigo ListService). */
export interface ListCampaignsFilters {
  companyId: number | string;
  searchParam?: string;
  pageNumber?: string;
}

export interface ListCampaignsResult {
  records: Campaign[];
  count: number;
  hasMore: boolean;
}
