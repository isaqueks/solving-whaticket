/**
 * Filtros de `WhatsappService.list` (doc 04 §4). `session == 0` faz o service
 * omitir o campo `session` no retorno — comportamento original do
 * ListWhatsAppsService.
 */
export interface ListWhatsappsFilters {
  companyId: number;
  session?: number | string;
}
