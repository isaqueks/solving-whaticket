import QueueIntegrations from "../models/QueueIntegrations";

/** Filtros da listagem paginada (antigo ListQueueIntegrationService). */
export interface ListQueueIntegrationsFilters {
  searchParam?: string;
  pageNumber?: string | number;
  companyId: number;
}

export interface ListQueueIntegrationsResult {
  queueIntegrations: QueueIntegrations[];
  count: number;
  hasMore: boolean;
}
