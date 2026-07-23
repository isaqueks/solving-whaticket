/** Entrada de atualização de fila; todos os campos opcionais (patch parcial). */
export interface UpdateQueueDto {
  name?: string;
  color?: string;
  greetingMessage?: string;
  outOfHoursMessage?: string;
  schedules?: unknown[];
  orderQueue?: number | null;
  integrationId?: number | null;
  promptId?: number | null;
}
