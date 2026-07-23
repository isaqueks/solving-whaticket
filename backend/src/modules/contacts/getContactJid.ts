import Contact from "./models/Contact";

/**
 * Monta o JID Baileys de um contato (antigo `helpers/getContactJid.ts`).
 * Utilitário PURO do domínio (exceção do doc 04 §2), mantido com o mesmo nome
 * e assinatura: os ~8 importadores (wbot/tickets) mudam apenas o path.
 */
export function getContactJid(contact: Contact): string {

  if (contact.isGroup) {
    return `${contact.number}@g.us`;
  }

  if (contact.addressingMode === 'lid' && contact.lidNumber) {
    return `${contact.lidNumber}@lid`;
  }

  return `${contact.number}@s.whatsapp.net`;
}
