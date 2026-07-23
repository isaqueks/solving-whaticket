/**
 * Entrada de `ChatsService.createMessage`. `companyId` é usado apenas para os
 * eventos de realtime (nome do evento por empresa/chat).
 */
export interface CreateChatMessageDto {
  chatId: number;
  senderId: number;
  message: string;
  companyId: number;
}
