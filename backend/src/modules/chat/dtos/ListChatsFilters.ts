import Chat from "../models/Chat";

/** Entrada de `ChatsService.list` (chats em que o usuário participa). */
export interface ListChatsFilters {
  ownerId: number;
  /** Vem da query string; default "1" (comportamento original). */
  pageNumber?: string;
}

/** Saída de `ChatsService.list`. */
export interface ListChatsResult {
  records: Chat[];
  count: number;
  hasMore: boolean;
}
