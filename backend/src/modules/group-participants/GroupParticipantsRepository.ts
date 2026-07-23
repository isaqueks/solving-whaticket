import { Op } from "sequelize";

import Contact from "../contacts/models/Contact";
import GroupParticipant from "./models/GroupParticipant";

/** Atributos de criação de um vínculo grupo↔participante. */
export interface GroupParticipantDefaults {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  companyId: number;
}

/**
 * Único ponto de acesso ao model GroupParticipant (doc 04 §3). Não emite
 * socket nem lança erro de negócio — retorna dados/null e o service decide.
 *
 * Acessa também o model Contact (domínio contacts, já migrado): as buscas de
 * participante aqui são queries NÃO-cacheadas específicas do sync — os
 * finders públicos do ContactsRepository têm semântica de cache diferente, e
 * o hot-path exige o comportamento original. Mantidas aqui como exceção
 * pragmática (doc 04 §3), concentrando o acesso a model num único lugar.
 */
export class GroupParticipantsRepository {
  /** Contato do grupo, escopado por empresa (guard HTTP do controller). */
  public async findGroupContactForCompany(
    contactId: number,
    companyId: number
  ): Promise<Contact | null> {
    return Contact.findOne({ where: { id: contactId, companyId } });
  }

  /** Contato do grupo por PK (validação interna do sync, sem escopo). */
  public async findGroupContact(contactId: number): Promise<Contact | null> {
    return Contact.findByPk(contactId);
  }

  /** Participantes do grupo com o Contact incluído (para nome/ordenação). */
  public async findParticipantsByGroup(
    groupContactId: number
  ): Promise<GroupParticipant[]> {
    return GroupParticipant.findAll({
      where: { groupContactId },
      include: [{ model: Contact, as: "participantContact" }]
    });
  }

  /** Remove vínculos por id (participantes que saíram do grupo). */
  public async destroyParticipants(ids: number[]): Promise<void> {
    await GroupParticipant.destroy({ where: { id: { [Op.in]: ids } } });
  }

  public async findParticipantContactByLid(
    lidNumber: string,
    companyId: number
  ): Promise<Contact | null> {
    return Contact.findOne({ where: { lidNumber, companyId } });
  }

  public async findParticipantContactByNumber(
    number: string,
    companyId: number
  ): Promise<Contact | null> {
    return Contact.findOne({
      where: { number, companyId, isGroup: false }
    });
  }

  public async updateContactName(
    contact: Contact,
    name: string
  ): Promise<void> {
    await contact.update({ name });
  }

  /** Cria o vínculo se não existir; retorna [instância, criado?]. */
  public async findOrCreateParticipant(
    where: { groupContactId: number; participantContactId: number },
    defaults: GroupParticipantDefaults
  ): Promise<[GroupParticipant, boolean]> {
    return GroupParticipant.findOrCreate({ where, defaults });
  }

  public async updateParticipant(
    groupParticipant: GroupParticipant,
    attributes: { isAdmin: boolean; isSuperAdmin: boolean }
  ): Promise<void> {
    await groupParticipant.update(attributes);
  }
}
