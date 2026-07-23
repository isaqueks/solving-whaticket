import { proto } from "baileys";

import { debounce } from "../../helpers/Debounce";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import SyncGroupParticipantsService from "../GroupParticipantServices/SyncGroupParticipantsService";
import { getContactMetadata, getGroupMetadata } from "../getContactMetadata";
import { getCachedPFP } from "./GetCachedPFP";
import { Session } from "./types";

export const verifyContact = async (
  msgContact: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number
): Promise<Contact> => {

  const meta = getContactMetadata(msgContact);

  const profilePicUrl: string = await getCachedPFP(wbot, meta.jid);

  const contactData = {
    name: meta.name || msgContact.key.remoteJid.replace(/[^0-9|-]/g, ""),
    number: meta.number,
    lidNumber: meta.lidNumber,
    addressingMode: meta.addressingMode,
    profilePicUrl,
    isGroup: false,
    companyId,
    whatsappId: wbot.id,
    keepName: true
  };

  const contact = await CreateOrUpdateContactService(contactData);

  return contact;
};

export const verifyGroup = async (
  msgContact: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number
): Promise<Contact> => {

  const meta = getGroupMetadata(msgContact);

  const wbotMeta = await wbot.groupMetadata(meta.jid);

  const profilePicUrl: string = await getCachedPFP(wbot, meta.jid);

  const contactData = {
    name: wbotMeta.subject || `GRUPO SEM NOME`,
    number: meta.number,
    profilePicUrl,
    isGroup: true,
    companyId,
    whatsappId: wbot.id,
    keepName: true
  };

  const contact = await CreateOrUpdateContactService(contactData);

  // Sincroniza participantes do grupo com debounce para evitar flood
  const syncParticipants = async () => {
    try {
      await SyncGroupParticipantsService({
        contactId: contact.id,
        wbot,
        forceSync: false
      });
    } catch (error) {
      logger.error(`Erro ao sincronizar participantes do grupo ${contact.id}:`, error);
    }
  };

  // Debounce de 10 segundos para não sincronizar a cada mensagem.
  // Chave namespaced para não colidir com os debounces por ticket.id.
  const debouncedSync = debounce(syncParticipants, 10000, `group-${contact.id}`);
  debouncedSync();

  return contact;
};
