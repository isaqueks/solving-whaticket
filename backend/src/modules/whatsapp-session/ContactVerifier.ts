import { proto } from "baileys";

import { debounce } from "../../shared/helpers/Debounce";
import { logger } from "../../utils/logger";

import {
  getContactMetadata,
  getGroupMetadata
} from "../contacts/ContactMetadataParser";
// Ciclo ContactsService ⇄ módulo da sessão: usar o singleton SEMPRE dentro do
// corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { contactsService } from "../contacts/ContactsService";
import Contact from "../contacts/models/Contact";
// Idem para o GroupParticipantsService (usa a sessão wbot para sincronizar).
import { groupParticipantsService } from "../group-participants/GroupParticipantsService";

import { profilePicService } from "./ProfilePicService";
import { Session } from "./types";

/**
 * Resolução do contato/grupo de uma mensagem recebida (antigo
 * `wbotContactVerifier`): extrai os metadados, busca a foto de perfil com
 * cache e faz o upsert via ContactsService — caminho quente, lógica preservada.
 */
export class ContactVerifier {
  public async verifyContact(
    msgContact: proto.IWebMessageInfo,
    wbot: Session,
    companyId: number
  ): Promise<Contact> {
    const meta = getContactMetadata(msgContact);

    const profilePicUrl: string = await profilePicService.getCachedPFP(
      wbot,
      meta.jid
    );

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

    const contact = await contactsService.createOrUpdate(contactData);

    return contact;
  }

  public async verifyGroup(
    msgContact: proto.IWebMessageInfo,
    wbot: Session,
    companyId: number
  ): Promise<Contact> {
    const meta = getGroupMetadata(msgContact);

    const wbotMeta = await wbot.groupMetadata(meta.jid);

    const profilePicUrl: string = await profilePicService.getCachedPFP(
      wbot,
      meta.jid
    );

    const contactData = {
      name: wbotMeta.subject || `GRUPO SEM NOME`,
      number: meta.number,
      profilePicUrl,
      isGroup: true,
      companyId,
      whatsappId: wbot.id,
      keepName: true
    };

    const contact = await contactsService.createOrUpdate(contactData);

    // Sincroniza participantes do grupo com debounce para evitar flood
    const syncParticipants = async () => {
      try {
        await groupParticipantsService.sync({
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
  }
}

export const contactVerifier = new ContactVerifier();
