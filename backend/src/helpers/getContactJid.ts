import Contact from "../models/Contact";


export function getContactJid(contact: Contact): string {

  if (contact.isGroup) {
    return `${contact.number}@g.us`;
  }

  if (contact.addressingMode === 'lid' && contact.lidNumber) {
    return `${contact.lidNumber}@lid`;
  }

  return `${contact.number}@s.whatsapp.net`;
}