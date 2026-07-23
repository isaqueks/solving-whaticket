/**
 * Entrada dos relatórios por período (`GET /dashboard/ticketsUsers` e
 * `GET /dashboard/ticketsDay`). Antigo `Request` de `TicketsAttendance` e
 * `TicketsDayService`. `companyId` vem de `req.user` (auth da rodada 1), não
 * da query string.
 */
export interface ReportPeriodFilters {
  initialDate: string;
  finalDate: string;
  companyId: number;
}

/**
 * Linha do relatório de atendimentos por usuário. Os campos em português
 * (`quantidade`, `nome`) são aliases das colunas do SQL e chaves do JSON lido
 * pelo frontend (`pages/Dashboard/ChartsUser`) — preservados verbatim.
 */
export interface AttendanceByUser {
  quantidade: number;
  data?: number;
  nome?: string;
}

/** Saída de `ReportsService.getTicketsAttendance` (antigo `{ data }`). */
export interface TicketsAttendanceResult {
  data: AttendanceByUser[];
}

/**
 * Linha do relatório de tickets por dia/hora. `total`/`horario`/`data` são
 * aliases das colunas do SQL e chaves do JSON lido pelo frontend
 * (`pages/Dashboard/ChartsDate`) — preservados verbatim.
 */
export interface TicketsByDay {
  total: number;
  data?: number;
  horario?: string;
}

/** Saída de `ReportsService.getTicketsByDay` (antigo `{ count, data }`). */
export interface TicketsByDayResult {
  count: number;
  data: TicketsByDay[];
}
