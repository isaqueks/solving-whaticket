/** Entrada de criação de opção de fila (nó do chatbot da fila). */
export interface CreateQueueOptionDto {
  queueId: string | number;
  title: string;
  option: string;
  message?: string;
  parentId?: string | number;
}
