import ChatMessage from "../models/ChatMessage";

/** Entrada de `ChatsService.findMessages` (mensagens paginadas de um chat). */
export interface FindChatMessagesFilters {
  chatId: string;
  ownerId: number;
  /** Vem da query string; default "1" (comportamento original). */
  pageNumber?: string;
}

/** Saída de `ChatsService.findMessages` (ordenada ascendente por id). */
export interface FindChatMessagesResult {
  records: ChatMessage[];
  count: number;
  hasMore: boolean;
}
