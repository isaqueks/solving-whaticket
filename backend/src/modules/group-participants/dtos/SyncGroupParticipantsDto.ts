import { GroupMetadata } from "baileys";

/**
 * Contrato mínimo da sessão wbot exigido pela sincronização: apenas o
 * `groupMetadata` (e o `id` opcional). A `Session` completa do wbot
 * (modules/whatsapp-session/types.ts, baseada em WASocket) é estruturalmente
 * compatível — o caller do hot-path continua passando a sua própria `Session`.
 */
export type WbotGroupSession = {
  id?: number;
  groupMetadata: (jid: string) => Promise<GroupMetadata>;
};

/**
 * Entrada de `GroupParticipantsService.sync` — o caso de uso chamado, com
 * debounce, POR MENSAGEM de grupo pelo listener do wbot
 * (modules/whatsapp-session/ContactVerifier.ts). A lógica está preservada
 * linha a linha do SyncGroupParticipantsService original (flag forceSync,
 * tratamento de erro, chamada `wbot.groupMetadata`).
 */
export interface SyncGroupParticipantsDto {
  contactId: number;
  wbot: WbotGroupSession;
  forceSync?: boolean;
}
