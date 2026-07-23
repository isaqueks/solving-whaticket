import { GroupMetadata } from "baileys";

import { cacheLayer } from "../../libs/cache";
// Runtime da sessão (grupo cíclico whatsapp-session ⇄ group-participants):
// usar o singleton SEMPRE dentro do corpo dos métodos (binding CommonJS lazy).
import { sessionManager } from "../whatsapp-session/SessionManager";
import AppError from "../../shared/errors/AppError";
import { logger } from "../../utils/logger";
import { contactsService, ContactsService } from "../contacts/ContactsService";
import { getContactJid } from "../contacts/getContactJid";
import Contact from "../contacts/models/Contact";
import { ListGroupParticipantsFilters } from "./dtos/ListGroupParticipantsFilters";
import { SyncGroupParticipantsDto } from "./dtos/SyncGroupParticipantsDto";
import GroupParticipant from "./models/GroupParticipant";
import { GroupParticipantsRepository } from "./GroupParticipantsRepository";

const CACHE_TTL = 30 * 60; // 30 minutos em segundos
const CACHE_KEY_PREFIX = "group-participants-sync";

type ParticipantMetadata = GroupMetadata["participants"][number];

/**
 * Casos de uso do domínio GroupParticipants (doc 04 §§2–3). Absorve os antigos
 * ListGroupParticipantsService e SyncGroupParticipantsService e a lógica de
 * boundary do GroupParticipantController.
 *
 * ATENÇÃO: `sync` é chamado, com debounce, POR MENSAGEM de grupo pelo listener
 * do wbot — a lógica (cache, extração de JID lid/pn, admin/superadmin,
 * find/create de Contact, findOrCreate anti-corrida) está preservada linha a
 * linha do SyncGroupParticipantsService original.
 *
 * Sem emissão de realtime: o domínio nunca emitiu socket, logo não há
 * dependência de RealtimeGateway.
 */
export class GroupParticipantsService {
  constructor(
    private readonly repository = new GroupParticipantsRepository(),
    // Sem default de singleton aqui: este service participa do ciclo
    // contacts ⇄ whatsapp-session; capturar `contactsService` no construtor
    // dependeria da ordem de avaliação dos módulos (CommonJS). A resolução é
    // feita em tempo de chamada (ver `resolveContacts`).
    private readonly contacts?: ContactsService
  ) {}

  private resolveContacts(): ContactsService {
    return this.contacts ?? contactsService;
  }

  /** GET /contacts/:contactId/participants (escopado por empresa). */
  public async list(
    filters: ListGroupParticipantsFilters
  ): Promise<GroupParticipant[]> {
    const { contactId, companyId } = filters;

    await this.ensureGroupContact(contactId, companyId);

    const participants = await this.repository.findParticipantsByGroup(
      contactId
    );

    return this.sortParticipants(participants);
  }

  /**
   * POST /contacts/:contactId/participants/sync — valida o grupo no escopo da
   * empresa, resolve a conexão wbot e delega ao caso de uso `sync`.
   */
  public async syncForCompany(
    contactId: number,
    companyId: number,
    forceSync: boolean
  ): Promise<GroupParticipant[]> {
    const contact = await this.ensureGroupContact(contactId, companyId);

    const wbot = sessionManager.getWbot(contact.whatsappId);

    return this.sync({ contactId, wbot, forceSync });
  }

  /**
   * Sincroniza os participantes do grupo com o metadata do WhatsApp. Chamado
   * pelo controller (HTTP) e pelo listener do wbot (hot-path, com debounce).
   */
  public async sync(dto: SyncGroupParticipantsDto): Promise<GroupParticipant[]> {
    const { contactId, wbot, forceSync = false } = dto;

    const contact = await this.repository.findGroupContact(contactId);

    if (!contact) {
      throw new AppError("Contato não encontrado", 404);
    }

    if (!contact.isGroup) {
      throw new AppError("O contato não é um grupo", 400);
    }

    const cacheKey = `${CACHE_KEY_PREFIX}:${contactId}`;

    // Verifica cache se não for sync forçado
    if (!forceSync) {
      const cachedSync = await cacheLayer.get(cacheKey);
      if (cachedSync) {
        logger.debug(`Cache hit para participantes do grupo ${contactId}`);
        // Retorna participantes do banco mesmo com cache válido
        const cachedParticipants = await this.repository.findParticipantsByGroup(
          contactId
        );
        return this.sortParticipants(cachedParticipants);
      }
    }

    // Busca metadata do grupo via Baileys
    const groupJid = getContactJid(contact);

    let groupMetadata: GroupMetadata;
    try {
      groupMetadata = await wbot.groupMetadata(groupJid);
    } catch (error) {
      logger.error(`Erro ao buscar metadata do grupo ${groupJid}:`, error);
      throw new AppError("Erro ao buscar informações do grupo", 500);
    }

    // Processa participantes
    const participants = groupMetadata.participants || [];

    // Extrai JIDs dos participantes atuais para comparação
    const currentParticipantJids = participants.map(p => {
      return typeof p === "string" ? p : p.id;
    });

    // Busca todos os participantes atuais do grupo no banco
    const existingGroupParticipants = await this.repository.findParticipantsByGroup(
      contactId
    );

    // Identifica participantes que não estão mais no grupo (por JID)
    const normalizedCurrentJids = currentParticipantJids.map(jid =>
      this.normalizeJid(jid)
    );

    const participantsToRemove = existingGroupParticipants.filter(gp => {
      if (!gp.participantContact) return true;
      const contactJid = getContactJid(gp.participantContact);
      const normalizedContactJid = this.normalizeJid(contactJid);
      return !normalizedCurrentJids.includes(normalizedContactJid);
    });

    // Remove participantes que não estão mais no grupo
    if (participantsToRemove.length > 0) {
      await this.repository.destroyParticipants(
        participantsToRemove.map(p => p.id)
      );
    }

    // Cria ou atualiza participantes
    const participantPromises = participants.map(participant =>
      this.syncParticipant(participant, contact, contactId)
    );

    const syncedParticipants = (await Promise.all(participantPromises)).filter(
      p => p !== null
    ) as GroupParticipant[];

    // Atualiza cache
    await cacheLayer.set(cacheKey, Date.now().toString(), "EX", CACHE_TTL);

    logger.info(
      `Sincronizados ${syncedParticipants.length} participantes do grupo ${contactId}`
    );

    // Retorna participantes com Contact incluído
    const allParticipants = await this.repository.findParticipantsByGroup(
      contactId
    );

    return this.sortParticipants(allParticipants);
  }

  /**
   * Cria/atualiza o vínculo de um participante do metadata. Retorna `null`
   * quando não há JID utilizável ou o Contact não pôde ser resolvido
   * (comportamento original: entrada descartada do resultado).
   */
  private async syncParticipant(
    participant: ParticipantMetadata,
    contact: Contact,
    contactId: number
  ): Promise<GroupParticipant | null> {
    const jid = typeof participant === "string" ? participant : participant.id;

    // Extrai informações do participante
    const { number, lidNumber } = this.extractParticipantInfo(jid);

    // Verifica se é admin
    const isAdmin =
      typeof participant === "object"
        ? participant.admin === "admin" || participant.admin === "superadmin"
        : false;

    const isSuperAdmin =
      typeof participant === "object"
        ? participant.admin === "superadmin"
        : false;

    // Busca nome do participante (pode estar no metadata)
    let participantName = "";
    if (typeof participant === "object" && participant.notify) {
      participantName = participant.notify;
    }

    // Busca ou cria Contact do participante
    let participantContact: Contact;

    try {
      // Tenta buscar por lidNumber primeiro, depois por number
      if (lidNumber) {
        participantContact = await this.repository.findParticipantContactByLid(
          lidNumber,
          contact.companyId
        );
      }

      if (!participantContact && number) {
        participantContact = await this.repository.findParticipantContactByNumber(
          number.replace(/[^0-9|-]/g, ""),
          contact.companyId
        );
      }

      // Se não encontrou, cria novo Contact
      if (!participantContact) {
        if (!number && !lidNumber) {
          logger.warn(
            `Não foi possível criar Contact para participante com JID: ${jid}`
          );
          return null;
        }

        participantContact = await this.resolveContacts().createOrUpdate({
          name: participantName || number || lidNumber || "Sem nome",
          number: number ? number.replace(/[^0-9|-]/g, "") : undefined,
          lidNumber,
          isGroup: false,
          companyId: contact.companyId,
          whatsappId: contact.whatsappId,
          addressingMode: lidNumber ? "lid" : "pn"
        });
      } else {
        // Atualiza nome se necessário
        if (participantName && participantContact.name !== participantName) {
          await this.repository.updateContactName(
            participantContact,
            participantName
          );
        }
      }
    } catch (error) {
      logger.error(
        `Erro ao criar/buscar Contact para participante ${jid}:`,
        error
      );
      return null;
    }

    // Busca ou cria GroupParticipant
    const [groupParticipant, created] = await this.repository.findOrCreateParticipant(
      {
        groupContactId: contactId,
        participantContactId: participantContact.id
      },
      {
        isAdmin,
        isSuperAdmin,
        companyId: contact.companyId
      }
    );

    // Atualiza se já existia
    if (!created) {
      await this.repository.updateParticipant(groupParticipant, {
        isAdmin,
        isSuperAdmin
      });
    }

    return groupParticipant;
  }

  /** Valida que o contato existe na empresa e é um grupo. */
  private async ensureGroupContact(
    contactId: number,
    companyId: number
  ): Promise<Contact> {
    const contact = await this.repository.findGroupContactForCompany(
      contactId,
      companyId
    );

    if (!contact) {
      throw new AppError("Contato não encontrado", 404);
    }

    if (!contact.isGroup) {
      throw new AppError("O contato não é um grupo", 400);
    }

    return contact;
  }

  /**
   * Ordenação manual (comportamento original): superadmins, depois admins,
   * depois por nome do contato.
   */
  private sortParticipants(
    participants: GroupParticipant[]
  ): GroupParticipant[] {
    return participants.sort((a, b) => {
      if (a.isSuperAdmin !== b.isSuperAdmin) {
        return b.isSuperAdmin ? 1 : -1;
      }
      if (a.isAdmin !== b.isAdmin) {
        return b.isAdmin ? 1 : -1;
      }
      const nameA = a.participantContact?.name || "";
      const nameB = b.participantContact?.name || "";
      return nameA.localeCompare(nameB);
    });
  }

  /** Extrai number e lidNumber de um JID de participante. */
  private extractParticipantInfo(jid: string): {
    number?: string;
    lidNumber?: string;
  } {
    const result: { number?: string; lidNumber?: string } = {};

    if (jid.endsWith("@lid")) {
      result.lidNumber = jid.replace("@lid", "");
    } else if (jid.includes("@s.whatsapp.net")) {
      result.number = jid.split("@")[0].split(":")[0];
    } else if (jid.includes("@lid")) {
      result.lidNumber = jid.split("@")[0];
    }

    return result;
  }

  /** Normaliza JID para comparação (remove sufixos e normaliza formato). */
  private normalizeJid(jid: string): string {
    if (!jid) return "";
    // Remove sufixos comuns
    return jid.split("@")[0].split(":")[0];
  }
}

export const groupParticipantsService = new GroupParticipantsService();
