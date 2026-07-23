/** Entrada de `SchedulesService.update` (doc 04 §4). Campos ausentes não mudam. */
export interface UpdateScheduleDto {
  body?: string;
  sendAt?: string;
  sentAt?: string;
  contactId?: number;
  ticketId?: number;
  userId?: number;
}
