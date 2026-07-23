/** Entrada de criação de fila (setor de atendimento). */
export interface CreateQueueDto {
  name: string;
  color: string;
  companyId: number;
  greetingMessage?: string;
  outOfHoursMessage?: string;
  schedules?: unknown[];
  orderQueue?: number | null;
  integrationId?: number | null;
  promptId?: number | null;
}
