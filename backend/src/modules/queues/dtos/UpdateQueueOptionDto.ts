/** Entrada de atualização de opção de fila; campos opcionais (patch parcial). */
export interface UpdateQueueOptionDto {
  queueId?: string | number;
  title?: string;
  option?: string;
  message?: string;
  parentId?: string | number;
}
