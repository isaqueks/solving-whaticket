import { proto } from "baileys";

import { logger } from "../../utils/logger";

/**
 * Parsers PUROS de metadados de contato/grupo a partir de uma mensagem do
 * Baileys (antigo `services/getContactMetadata.ts` da raiz). Sem I/O e sem
 * estado — funções nomeadas (exceção do doc 04 §2 para utilitários puros),
 * mantidas com os MESMOS nomes para que os importadores do wbot mudem só o
 * path. Lógica intocada: é insumo direto do caminho quente por mensagem.
 */

export interface ContactMetadata {
  number?: string;
  lidNumber?: string | null;
  addressingMode?: string | null;
  name?: string;
  isFromGroup?: boolean;
  jid?: string;
}

/**
 * Campos que o Baileys entrega em runtime além do typing oficial de
 * IMessageKey (addressingMode, participantAlt, remoteJidAlt) — view apenas de
 * tipo, sem efeito em runtime.
 */
type LooseMessageKey = proto.IMessageKey &
  Record<string, string | null | undefined>;

export function getContactMetadata(msg: proto.IWebMessageInfo): ContactMetadata {
  const key = msg.key as LooseMessageKey;
  const isGroup = key.remoteJid.includes("@g.us");

  const result: ContactMetadata = {
    addressingMode: key['addressingMode'] || undefined,
    name: msg.pushName || undefined,
    isFromGroup: isGroup,
    jid: isGroup ? (msg.participant || key.participant) : key.remoteJid
  };

  let keys: string[] = [];

  if (isGroup) {
    keys = [
      msg.participant || key.participant,
      key['participantAlt']
    ]
  }
  else {
    keys = [
      key.remoteJid,
      key['remoteJidAlt']
    ]
  }

  for (const key of keys) {
    if (!key) {
      continue;
    }
    if (key.endsWith('@lid')) {
      result.lidNumber = key.replace('@lid', '');
    }
    else if (key.endsWith('@s.whatsapp.net')) {
      result.number = key.replace('@s.whatsapp.net', '').split(':')[0];
    }
    else {
      // Era console.error (proibido no backend — doc 04 §6); mesmo aviso via pino.
      logger.error({ msg }, "Unknown contact key format: %s", key);
    }
  }

  return result;
}

export function getGroupMetadata(msg: proto.IWebMessageInfo): ContactMetadata {
  const key = msg.key as LooseMessageKey;
  const isGroup = key.remoteJid.includes("@g.us");
  if (!isGroup) {
    return null;
  }

  const result: ContactMetadata = {
    addressingMode: key['addressingMode'] || undefined,
    name: msg.pushName || undefined,
    isFromGroup: isGroup,
    jid: key.remoteJid,
    number: key.remoteJid?.replace('@g.us', '')
  };

  return result;
}
