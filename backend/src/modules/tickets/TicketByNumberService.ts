import { ContactsRepository } from "../contacts/ContactsRepository";
import { UsersRepository } from "../users/UsersRepository";
// Validação de número no runtime da sessão (grupo cíclico tickets ⇄
// whatsapp-session): usar o singleton apenas dentro do corpo dos métodos.
import { contactValidator } from "../whatsapp-session/ContactValidator";
import { TicketByNumberResult } from "./dtos/TicketByNumberResult";
import { TicketsRepository } from "./TicketsRepository";
import { TicketsService, ticketsService } from "./TicketsService";

const NUM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const NUM_CACHE_MAX_SIZE = 5000;

/**
 * Cache limitado de existência de número no WhatsApp (estado de processo,
 * compartilhado entre requisições — mesmo padrão do lidCache do módulo
 * contacts). Absorvido do antigo GetTicketByNumberController.
 */
const numExistCache = new Map<string, { exists: boolean; timestamp: number }>();

function pruneNumCache(): void {
  const now = Date.now();
  for (const [key, value] of numExistCache) {
    if (now - value.timestamp >= NUM_CACHE_TTL) {
      numExistCache.delete(key);
    }
  }

  // Hard cap: if still over the limit, evict oldest (insertion-ordered) entries.
  if (numExistCache.size > NUM_CACHE_MAX_SIZE) {
    const excess = numExistCache.size - NUM_CACHE_MAX_SIZE;
    let removed = 0;
    for (const key of numExistCache.keys()) {
      if (removed >= excess) break;
      numExistCache.delete(key);
      removed += 1;
    }
  }
}

/** Regex de número BR com nono dígito (forma original preservada). */
const BR_NINTH_DIGIT_REGEX = /^(55[0-9][0-9])9([0-9]{8})$/;

/**
 * Caso de uso GET /ticket-by-number: localiza o contato pelas variações do
 * número, valida a existência no WhatsApp (com cache limitado) e devolve o
 * primeiro ticket do contato, criando um fechado se não houver — lógica
 * absorvida do antigo GetTicketByNumberController, preservada.
 */
export class TicketByNumberService {
  constructor(
    private readonly ticketsRepository = new TicketsRepository(),
    private readonly contactsRepository = new ContactsRepository(),
    private readonly usersRepository = new UsersRepository(),
    private readonly tickets: TicketsService = ticketsService
  ) {}

  public async getOrCreateByNumber(
    phone: string,
    companyId: number,
    requestUserId: string
  ): Promise<TicketByNumberResult> {
    const numbers = BR_NINTH_DIGIT_REGEX.test(phone)
      ? [phone.replace(BR_NINTH_DIGIT_REGEX, "$1$2"), phone]
      : [phone];

    const contact = await this.contactsRepository.findByAnyNumberAndCompany(
      numbers,
      companyId
    );

    if (!contact) {
      let exist = false;
      for (const num of numbers) {
        exist = await this.checkValid(num, companyId);
        if (exist) break;
      }

      if (!exist) {
        return { error: "Número inválido" };
      }

      return { error: "Contact not found" };
    }

    const existingTicket = await this.ticketsRepository.findFirstByContactAndCompany(
      contact.id,
      companyId
    );

    let user = await this.usersRepository.findById(requestUserId);

    if (contact.attachedToEmail) {
      const foundUser = await this.usersRepository.findByCompanyAndEmail(
        companyId,
        contact.attachedToEmail
      );

      if (foundUser) {
        user = foundUser;
      }
    }

    if (!existingTicket) {
      const ticket = await this.tickets.create({
        contactId: contact.id,
        status: "closed",
        companyId,
        userId: user.id
      });

      return { ticket };
    }

    return { ticket: existingTicket };
  }

  /** Existência do número no WhatsApp, com cache TTL + poda (preservado). */
  private async checkValid(num: string, cpId: number): Promise<boolean> {
    const cached = numExistCache.get(num);
    if (cached && Date.now() - cached.timestamp < NUM_CACHE_TTL) {
      return cached.exists;
    }
    if (cached) {
      numExistCache.delete(num);
    }

    try {
      const valid = await contactValidator.checkNumber(num, cpId);
      numExistCache.set(num, { exists: valid.exists, timestamp: Date.now() });
      pruneNumCache();
      return valid.exists;
    } catch (err) {
      if (err instanceof Error && err.message.includes("ERR_CHECK_NUMBER")) {
        numExistCache.set(num, { exists: false, timestamp: Date.now() });
        pruneNumCache();
        return false;
      }
      throw err;
    }
  }
}
