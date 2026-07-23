import * as Sentry from "@sentry/node";
import { isString, isArray } from "lodash";

import { logger } from "../../utils/logger";

import { ContactsRepository } from "../contacts/ContactsRepository";
// Ciclo ContactsService ⇄ módulo da sessão: usar o singleton SEMPRE dentro do
// corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { contactsService } from "../contacts/ContactsService";
// Idem para o WhatsappService.
import { whatsappService } from "../whatsapp/WhatsappService";

import { BaileysStore } from "./BaileysStore";
import { sessionManager } from "./SessionManager";

/**
 * Importação dos contatos do APARELHO conectado (antigo
 * `WbotServices/ImportContactsService`): lê o snapshot sincronizado pelo
 * Baileys e cria/atualiza os contatos da empresa. Lógica preservada.
 */
export class PhoneContactsImporter {
  constructor(
    private readonly contactsRepository = new ContactsRepository(),
    private readonly baileysStore = new BaileysStore()
  ) {}

  public async importFromPhone(companyId: number): Promise<void> {
    const defaultWhatsapp = await whatsappService.getDefaultWhatsApp(companyId);
    const wbot = sessionManager.getWbot(defaultWhatsapp.id);

    let phoneContacts;

    try {
      const contactsString = await this.baileysStore.show(wbot.id);
      phoneContacts = JSON.parse(JSON.stringify(contactsString.contacts));
    } catch (err) {
      Sentry.captureException(err);
      logger.error(`Could not get whatsapp contacts from phone. Err: ${err}`);
    }

    const phoneContactsList = isString(phoneContacts)
      ? JSON.parse(phoneContacts)
      : phoneContacts;

    if (isArray(phoneContactsList)) {
      for (const { id, name, notify } of phoneContactsList) {
        if (id === "status@broadcast" || id.includes("g.us")) continue;
        const number = id.replace(/[^0-9|-]/g, "");

        const existingContact = await this.contactsRepository.findByNumberAndCompany(
          number,
          companyId
        );

        if (existingContact) {
          // Atualiza o nome do contato existente
          existingContact.name = name || notify;
          await this.contactsRepository.save(existingContact);
        } else {
          // Criar um novo contato
          try {
            await contactsService.create({
              number,
              name: name || notify,
              companyId
            });
          } catch (error) {
            Sentry.captureException(error);
            logger.warn(
              `Could not get whatsapp contacts from phone. Err: ${error}`
            );
          }
        }
      }
    }
  }
}

export const phoneContactsImporter = new PhoneContactsImporter();
