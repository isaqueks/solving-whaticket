/** Corpo do endpoint público de envio (POST /public/messages/send-by-number). */
export interface SendPublicMessageDto {
  to: string;
  content: string;
}

/** Dados do contato notificado — payload de sucesso do endpoint público. */
export interface SendPublicMessageResult {
  contactId: number;
  contactName: string;
}
