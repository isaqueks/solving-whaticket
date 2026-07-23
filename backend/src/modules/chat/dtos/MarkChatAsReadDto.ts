/** Entrada de `ChatsService.markAsRead` (zera os não-lidos de um participante). */
export interface MarkChatAsReadDto {
  chatId: string;
  userId: number;
  companyId: number;
}
