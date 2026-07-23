import { WASocket } from "baileys";

import { Store } from "./store";

/**
 * Sessão Baileys ativa: o socket cru anotado com o id da conexão (Whatsapp)
 * e o store opcional (forma histórica de `libs/wbot.ts`/`WbotServices/types`).
 */
export type Session = WASocket & {
  id?: number;
  store?: Store;
};
