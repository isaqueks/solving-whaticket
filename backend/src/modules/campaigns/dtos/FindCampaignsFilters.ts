/**
 * Filtro da lista plana GET /campaigns/list (antigo FindService).
 * Type alias (não interface) para aceitar o cast direto de `req.query`,
 * como o `FindParams` original.
 */
export type FindCampaignsFilters = {
  companyId: string;
};
