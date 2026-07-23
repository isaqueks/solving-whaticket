/**
 * Entrada de `SchedulesService.create` (doc 04 §4).
 * O service aplica o status inicial "PENDENTE" (comportamento original do
 * CreateService).
 */
export interface CreateScheduleDto {
  body: string;
  sendAt: string;
  contactId: number | string;
  companyId: number | string;
  userId?: number | string;
}
