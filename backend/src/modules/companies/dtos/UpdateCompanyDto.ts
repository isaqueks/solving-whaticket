/**
 * Entrada de `CompaniesService.update` (doc 04 §4). Todos os campos opcionais —
 * só os presentes no body são gravados (comportamento original do
 * UpdateCompanyService). `schedules` tem endpoint próprio (updateSchedules).
 */
export interface UpdateCompanyDto {
  name?: string;
  phone?: string;
  email?: string;
  status?: boolean;
  planId?: number;
  campaignsEnabled?: boolean;
  dueDate?: string;
  recurrence?: string;
}
