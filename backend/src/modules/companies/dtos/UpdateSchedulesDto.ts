/**
 * Entrada de `CompaniesService.updateSchedules` (doc 04 §4). O tipo de
 * `schedules` acompanha a coluna JSONB `schedules: []` do model Company
 * (comportamento original do UpdateSchedulesService).
 */
export interface UpdateSchedulesDto {
  id: number | string;
  schedules: [];
}
