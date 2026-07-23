import { ChatParticipantInput } from "./ChatParticipantInput";

/** Entrada de `ChatsService.create` (doc 04 §4). */
export interface CreateChatDto {
  title: string;
  users: ChatParticipantInput[];
  ownerId: number;
  companyId: number;
}
