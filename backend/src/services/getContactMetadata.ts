import { proto } from "baileys";

export interface ContactMetadata {
  number?: string;
  lidNumber?: string | null;
  addressingMode?: string | null;
  name?: string;
  isFromGroup?: boolean;
  jid?: string;
}

export function getContactMetadata(msg: proto.IWebMessageInfo): ContactMetadata {
  const isGroup = msg.key.remoteJid.includes("@g.us");
  
  const result: ContactMetadata = {
    addressingMode: msg.key['addressingMode'] || undefined,
    name: msg.pushName || undefined,
    isFromGroup: isGroup,
    jid: isGroup ? (msg.participant || msg.key.participant) : msg.key.remoteJid
  };

  let keys: string[] = [];

  if (isGroup) {
    keys = [
      msg.participant || msg.key.participant,
      msg.key['participantAlt']
    ]
  }
  else {
    keys = [
      msg.key.remoteJid,
      msg.key['remoteJidAlt']
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
      console.error(`Unknown contact key format: ${key}`, msg);
    }
  }

  return result;
}


export function getGroupMetadata(msg: proto.IWebMessageInfo): ContactMetadata {
  const isGroup = msg.key.remoteJid.includes("@g.us");
  if (!isGroup) {
    return null;
  }
  
  const result: ContactMetadata = {
    addressingMode: msg.key['addressingMode'] || undefined,
    name: msg.pushName || undefined,
    isFromGroup: isGroup,
    jid: msg.key.remoteJid,
    number: msg.key.remoteJid?.replace('@g.us', '')
  };

  return result;
}