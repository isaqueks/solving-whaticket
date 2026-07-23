/**
 * Corpo de atualização de uma conexão (subset editável do model Whatsapp).
 * Espelha o antigo `WhatsappData` do UpdateWhatsAppService.
 */
export interface UpdateWhatsappData {
  name?: string;
  status?: string;
  session?: string;
  isDefault?: boolean;
  greetingMessage?: string;
  complationMessage?: string;
  outOfHoursMessage?: string;
  ratingMessage?: string;
  queueIds?: number[];
  token?: string;
  //sendIdQueue?: number;
  //timeSendQueue?: number;
  transferQueueId?: number;
  timeToTransfer?: number;
  promptId?: number;
  maxUseBotQueues?: number;
  timeUseBotQueues?: number;
  expiresTicket?: number;
  expiresInactiveMessage?: string;
}

/** Entrada de `WhatsappService.update` (doc 04 §4). */
export interface UpdateWhatsappDto {
  whatsappData: UpdateWhatsappData;
  whatsappId: string;
  companyId: number;
}
