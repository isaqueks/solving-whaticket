/**
 * Dados da mensagem persistida (antigo `MessageData` do CreateMessageService).
 * Os campos além do contrato original (quotedMsgId, remoteJid, participant,
 * dataJson, isEdited, mediaUrl) sempre foram enviados pelos fluxos do wbot —
 * aqui ficam declarados explicitamente.
 */
export interface CreateMessageData {
  id: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  ack?: number;
  queueId?: number;
  quotedMsgId?: string;
  remoteJid?: string;
  participant?: string;
  dataJson?: string;
  isEdited?: boolean;
}

/** Entrada de `MessagesService.create` (caminho quente do wbot). */
export interface CreateMessageDto {
  messageData: CreateMessageData;
  companyId: number;
}
