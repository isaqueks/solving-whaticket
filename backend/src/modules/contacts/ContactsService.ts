import { head, has } from "lodash";
import XLSX from "xlsx";

import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { logger } from "../../utils/logger";
// Domínio whatsapp (migrado na B3): resolve a conexão padrão da empresa.
import { whatsappService } from "../whatsapp/WhatsappService";
// Ciclo TicketsService ⇄ ContactsService: usar o singleton SEMPRE dentro do
// corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { ticketsService } from "../tickets/TicketsService";
// Validações wbot no runtime da sessão (grupo cíclico contacts ⇄
// whatsapp-session): usar o singleton apenas dentro do corpo dos métodos.
import { contactValidator } from "../whatsapp-session/ContactValidator";
import { ContactsRepository } from "./ContactsRepository";
import { CreateContactDto } from "./dtos/CreateContactDto";
import { CreateOrUpdateContactDto } from "./dtos/CreateOrUpdateContactDto";
import { GetContactDto } from "./dtos/GetContactDto";
import {
  ListContactsFilters,
  ListContactsResult
} from "./dtos/ListContactsFilters";
import { SimpleListContactsFilters } from "./dtos/SimpleListContactsFilters";
import { SyncContactsWebhookDto } from "./dtos/SyncContactsWebhookDto";
import { UpdateContactDto } from "./dtos/UpdateContactDto";
import Contact from "./models/Contact";
import {
  getBrazilianNumberVariations,
  OnWhatsappNumberResolver
} from "./OnWhatsappNumberResolver";

/**
 * Casos de uso do domínio Contacts (doc 04 §§2–3). Absorve os 9 arquivos do
 * antigo `services/ContactServices/` + a lógica de negócio do antigo
 * ContactController gordo (checagens wbot, número canônico). Eventos de
 * domínio via RealtimeGateway (nunca `io.to` direto).
 *
 * ATENÇÃO: `createOrUpdate` é chamado POR MENSAGEM pelo listener do wbot —
 * a lógica (caches, lidNumber, keepName, findOrCreate anti-corrida) está
 * preservada linha a linha do CreateOrUpdateContactService original.
 */
export class ContactsService {
  constructor(
    private readonly repository = new ContactsRepository(),
    private readonly numberResolver = new OnWhatsappNumberResolver(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async list(filters: ListContactsFilters): Promise<ListContactsResult> {
    const { contacts, count, offset } =
      await this.repository.findAndCountByFilters(filters);

    const hasMore = count > offset + contacts.length;

    return { contacts, count, hasMore };
  }

  /**
   * Caso de uso de POST /contacts: valida o número no WhatsApp, canoniza para
   * o JID real, cria e emite o evento (fluxo original do controller.store —
   * a busca de profilePicUrl continua desabilitada por demora no retorno).
   */
  public async store(dto: CreateContactDto): Promise<Contact> {
    const { companyId } = dto;

    await contactValidator.checkIsValidContact(dto.number, companyId);
    const validNumber = await contactValidator.checkNumber(dto.number, companyId);
    const number = validNumber.jid.replace(/\D/g, "");

    const contact = await this.create({ ...dto, number });

    this.emitContactEvent(companyId, { action: "create", contact });

    return contact;
  }

  /**
   * Criação simples (antigo CreateContactService) — sem evento realtime, como
   * antes: também é usada pelo import de contatos do telefone (wbot).
   */
  public async create(dto: CreateContactDto): Promise<Contact> {
    const {
      name,
      number,
      email = "",
      taxId = "",
      companyId,
      extraInfo = []
    } = dto;

    const numberExists = await this.repository.findByNumberAndCompany(
      number,
      companyId
    );

    if (numberExists) {
      throw new AppError("ERR_DUPLICATED_CONTACT");
    }

    return this.repository.create({
      name,
      number,
      email,
      taxId,
      extraInfo,
      companyId
    });
  }

  public async show(id: string | number, companyId: number): Promise<Contact> {
    const contact = await this.repository.findByIdWithDetails(id);

    // Ordem das checagens preservada do ShowContactService original
    // (contato inexistente cai na primeira, com a mensagem de empresa).
    if (contact?.companyId !== companyId) {
      throw new AppError("Não é possível excluir registro de outra empresa");
    }

    if (!contact) {
      throw new AppError("ERR_NO_CONTACT_FOUND", 404);
    }

    return contact;
  }

  /**
   * Caso de uso de PUT /contacts/:contactId: valida/canoniza o número no
   * WhatsApp (fluxo original do controller.update), atualiza os campos e os
   * extraInfo (upsert + remoção dos ausentes) e emite o evento.
   */
  public async update(
    contactId: string,
    dto: UpdateContactDto,
    companyId: number
  ): Promise<Contact> {
    await contactValidator.checkIsValidContact(dto.number, companyId);
    const validNumber = await contactValidator.checkNumber(dto.number, companyId);
    const number = validNumber.jid.replace(/\D/g, "");

    const contactData = { ...dto, number };
    const { email, name, extraInfo } = contactData;

    const contact = await this.repository.findByIdForUpdate(contactId);

    if (contact?.companyId !== companyId) {
      throw new AppError("Não é possível alterar registros de outra empresa");
    }

    if (!contact) {
      throw new AppError("ERR_NO_CONTACT_FOUND", 404);
    }

    if (extraInfo) {
      await Promise.all(
        extraInfo.map(async info => {
          await this.repository.upsertCustomField(info, contact.id);
        })
      );

      await Promise.all(
        contact.extraInfo.map(async oldInfo => {
          const stillExists = extraInfo.findIndex(info => info.id === oldInfo.id);

          if (stillExists === -1) {
            await this.repository.deleteCustomField(oldInfo.id);
          }
        })
      );
    }

    await this.repository.updateInstance(contact, { name, number, email });
    await this.repository.reloadForResponse(contact);

    this.emitContactEvent(companyId, { action: "update", contact });

    return contact;
  }

  /** Caso de uso de DELETE /contacts/:contactId (show + delete + evento). */
  public async remove(contactId: string, companyId: number): Promise<void> {
    await this.show(contactId, companyId);

    const contact = await this.repository.findById(contactId);

    if (!contact) {
      throw new AppError("ERR_NO_CONTACT_FOUND", 404);
    }

    await this.repository.delete(contact);

    this.emitContactEvent(companyId, { action: "delete", contactId });
  }

  public async simpleList(
    filters: SimpleListContactsFilters
  ): Promise<Contact[]> {
    const contacts = await this.repository.findAllSimple(filters);

    if (!contacts) {
      throw new AppError("ERR_NO_CONTACT_FOUND", 404);
    }

    return contacts;
  }

  /** GET /contact (vcard): retorna o existente ou cria (antigo GetContactService). */
  public async getOrCreate(dto: GetContactDto): Promise<Contact> {
    const { name, number, companyId } = dto;

    const numberExists = await this.repository.findByNumberAndCompany(
      number,
      companyId
    );

    if (!numberExists) {
      const contact = await this.create({ name, number, companyId });

      if (contact == null) throw new AppError("CONTACT_NOT_FIND");
      else return contact;
    }

    return numberExists;
  }

  /**
   * CAMINHO QUENTE (wbot, por mensagem) — antigo CreateOrUpdateContactService.
   * Lógica preservada linha a linha: caches lid/número (TTL 5min no
   * repository), keepName, detecção de grupo por tamanho, variações BR,
   * findOrCreate anti-corrida e ticket automático para attachedToEmail.
   * Única diferença: o socket é resolvido de forma lazy pelo RealtimeGateway
   * no momento do emit (antes havia um getIO() incondicional no topo).
   */
  public async createOrUpdate(data: CreateOrUpdateContactDto): Promise<Contact> {
    let {
      name,
      number,
      profilePicUrl,
      isGroup,
      email,
      taxId,
      companyId,
      extraInfo = [],
      attachedToEmail,
      whatsappId,
      keepName = false,
      addressingMode,
      lidNumber
    } = data;

    if (!number) {
      if (!lidNumber) {
        // Antes: Error("Number or LID Number is required to create or update a contact.")
        throw new AppError("ERR_CONTACT_NUMBER_OR_LID_REQUIRED", 400);
      }

      const existing = await this.repository.findByLidNumberCached(
        lidNumber,
        companyId
      );

      if (existing) {
        number = existing.number;
      }
      else {
        // Antes: Error("Number is required to create or update a contact when LID Number does not exist.")
        throw new AppError("ERR_CONTACT_NUMBER_REQUIRED", 400);
      }
    }

    const GP = isGroup || (number && number.length > 13);
    number = GP ? number : number.replace(/[^0-9|-]/g, "");

    const variations = GP ? [number] : getBrazilianNumberVariations(number);

    let contact = await this.repository.findByNumbersCached(
      variations,
      companyId
    );

    if (contact) {
      if (keepName) {
        name = contact.name;
      }

      const dto: Partial<Contact> = {
        name,
        profilePicUrl,
        email: email || contact.email || '',
        taxId,
        attachedToEmail,
        number: contact.number,
        whatsappId: whatsappId || contact.whatsappId,
        addressingMode: addressingMode || contact.addressingMode,
        lidNumber: lidNumber || contact.lidNumber
      };

      if (
        contact.name !== dto.name ||
        contact.profilePicUrl !== dto.profilePicUrl ||
        contact.email !== dto.email ||
        contact.taxId !== dto.taxId ||
        contact.attachedToEmail !== dto.attachedToEmail ||
        contact.number !== dto.number ||
        contact.whatsappId !== dto.whatsappId ||
        contact.addressingMode !== dto.addressingMode ||
        contact.lidNumber !== dto.lidNumber
      ) {
        await this.repository.updateInstance(contact, dto);
        this.emitContactEvent(companyId, { action: "update", contact });
      }

    } else {

      const correctNumber = GP
        ? number
        : (await this.numberResolver.resolve(number, companyId));

      if (!correctNumber) {
        // Antes: Error("Contact with number ... does not exist on WhatsApp.")
        throw new AppError("ERR_CHECK_NUMBER", 404);
      }

      // findOrCreate guards against the duplicate-contact race: when two
      // concurrent messages from a brand-new number both miss the lookup above,
      // the composite unique constraint (number, companyId) would make the second
      // Contact.create throw. findOrCreate resolves that atomically and returns
      // whether this call actually created the row.
      const [createdContact, created] = await this.repository.findOrCreateByNumber(
        correctNumber,
        companyId,
        {
          name,
          number: correctNumber,
          profilePicUrl,
          email: email || '',
          isGroup,
          extraInfo,
          companyId,
          taxId,
          whatsappId,
          attachedToEmail,
          addressingMode,
          lidNumber
        } as Partial<Contact>
      );

      contact = createdContact;

      if (created && !GP && attachedToEmail) {

        const correspondingUser = await this.repository.findUserByCompanyAndEmail(
          companyId,
          attachedToEmail
        );

        if (correspondingUser) {
          const defaultWhatsapp = await whatsappService.getDefaultWhatsApp(companyId);
          await ticketsService.create({
            contactId: contact.id,
            status: 'closed',
            companyId,
            whatsappId: String(defaultWhatsapp.id),
            userId: correspondingUser.id
          });
        }
      }
    }

    return contact;
  }

  /**
   * Webhook custom do dono (POST /webhook/contacts/sync) — comportamento
   * CONGELADO do antigo ContactUpdateWebhookController: itera na ordem
   * recebida, segue no erro (só loga, mesma mensagem) e nunca falha o lote.
   */
  public async syncFromWebhook(dto: SyncContactsWebhookDto): Promise<void> {
    for (const item of dto.data) {
      try {
        await this.createOrUpdate({
          ...item,
          email: item.email || '',
          taxId: item.taxId || '',
          companyId: dto.companyId,
          isGroup: false
        });
      }
      catch (err) {
        logger.error(
          `Error syncing contact ${item.number || item.name}: ${err}`
        );
      }
    }
  }

  /**
   * Import por planilha XLSX (antigo ImportContacts) + evento em lote do
   * antigo controller.upload. A validação dos números no WhatsApp continua
   * rodando em background depois da resposta (comportamento original).
   */
  public async importFromFile(
    companyId: number,
    file: Express.Multer.File | undefined
  ): Promise<Contact[]> {
    const workbook = XLSX.readFile(file?.path as string);
    const worksheet = head(Object.values(workbook.Sheets)) as XLSX.WorkSheet;
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
      header: 0
    });
    const contacts = rows.map(row => {
      let name = "";
      let number = "";
      let email = "";

      if (has(row, "nome") || has(row, "Nome")) {
        name = row["nome"] || row["Nome"];
      }

      if (
        has(row, "numero") ||
        has(row, "número") ||
        has(row, "Numero") ||
        has(row, "Número")
      ) {
        number = row["numero"] || row["número"] || row["Numero"] || row["Número"];
        number = `${number}`.replace(/[^0-9|-]/g, "");
      }

      if (
        has(row, "email") ||
        has(row, "e-mail") ||
        has(row, "Email") ||
        has(row, "E-mail")
      ) {
        email = row["email"] || row["e-mail"] || row["Email"] || row["E-mail"];
      }

      return { name, number, email, companyId };
    });

    const contactList: Contact[] = [];

    for (const contact of contacts) {
      const [newContact, created] = await this.repository.findOrCreateByNumber(
        `${contact.number}`,
        contact.companyId,
        contact
      );
      if (created) {
        contactList.push(newContact);
      }
    }

    if (contactList) {
      // Validate numbers against WhatsApp in the background. Each checkNumber
      // performs a live Baileys network round-trip; awaiting thousands of them
      // sequentially inside the request holds the HTTP connection open until it
      // times out, so run the validation detached and respond immediately.
      this.verifyImportedNumbersInBackground(contactList, companyId);
    }

    this.emitContactEvent(companyId, { action: "create", records: contactList });

    return contactList;
  }

  private verifyImportedNumbersInBackground(
    contactList: Contact[],
    companyId: number
  ): void {
    (async () => {
      for (let newContact of contactList) {
        try {
          const response = await contactValidator.checkNumber(
            newContact.number,
            companyId
          );
          const number = response.jid.replace(/[^0-9|-]/g, "");
          newContact.number = number;
          await this.repository.save(newContact);
        } catch (e) {
          logger.error(`Número de contato inválido: ${newContact.number}`);
        }
      }
    })().catch(e => {
      logger.error(`Erro ao validar contatos importados: ${e}`);
    });
  }

  private emitContactEvent(companyId: number, payload: unknown): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyContact(companyId),
      payload
    );
  }
}

/**
 * Instância compartilhada para chamadores de fora do módulo (wbot, tickets,
 * messages). IMPORTANTE: usar sempre dentro do corpo de funções — nunca em
 * escopo de módulo — por causa do ciclo TicketsService ⇄ ContactsService
 * (bindings CommonJS resolvem lazy na chamada).
 */
export const contactsService = new ContactsService();
