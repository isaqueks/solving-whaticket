import { ChatParticipantInput } from "./ChatParticipantInput";

/**
 * Entrada de `ChatsService.update`. `companyId` é necessário para o evento de
 * realtime por usuário; `users` ausente mantém os participantes atuais
 * (comportamento original do UpdateService).
 */
export interface UpdateChatDto {
  id: number;
  companyId: number;
  title?: string;
  users?: ChatParticipantInput[];
}
