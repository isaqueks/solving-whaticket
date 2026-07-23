/**
 * Filtros do dashboard, vindos da query string de `GET /dashboard`
 * (antigo `Params` de `DashboardDataService`).
 *
 * Os nomes em snake_case (`date_from`/`date_to`) são preservados de propósito:
 * são chaves de query string enviadas pelo frontend (`pages/Dashboard`) —
 * renomear quebraria o contrato HTTP.
 */
export interface DashboardFilters {
  days?: number;
  date_from?: string;
  date_to?: string;
}

/**
 * Saída de `ReportsService.getDashboardData` — a query roda com `plain: true`,
 * retornando UMA linha com as duas colunas jsonb. As formas internas de
 * `counters`/`attendants` são montadas pelo SQL (jsonb) e repassadas cruas ao
 * frontend, por isso tipadas como estruturas genéricas em vez de `any`.
 */
export interface DashboardData {
  counters: Record<string, unknown>;
  attendants: unknown[];
}
