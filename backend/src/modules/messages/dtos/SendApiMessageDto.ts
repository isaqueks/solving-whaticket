/** Corpo aceito pela API externa de envio (POST /api/messages/send). */
export interface ApiMessagePayload {
  body: string;
  number?: string;
  closeTicket?: true;
}

/** Entrada de `MessagesService.sendApiMessage`. */
export interface SendApiMessageDto {
  whatsappId: number;
  messageData: ApiMessagePayload;
  medias?: Express.Multer.File[];
  /**
   * Usuário da requisição — nesta rota (tokenAuth) o `req.user` NÃO é
   * populado; a leitura de `.id` acontece DENTRO do try do service para
   * preservar o contrato original (falha vira ERR_SENDING_WAPP_MSG).
   */
  requestUser: { id: string };
}
