/** Entrada de `MessagesService.forward` (POST /messages/forward). */
export interface ForwardMessagesDto {
  contactId: number;
  whatsappId?: number;
  messagesId: string[];
}
