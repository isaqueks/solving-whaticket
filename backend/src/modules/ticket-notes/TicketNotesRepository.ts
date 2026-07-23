import { Op, Sequelize, WhereOptions } from "sequelize";

import Contact from "../contacts/models/Contact";
import Ticket from "../tickets/models/Ticket";
import User from "../users/models/User";
import { FindNotesFilters } from "./dtos/FindNotesFilters";
import TicketNote from "./models/TicketNote";

/** Atributos persistíveis de TicketNote (subset usado pelo domínio). */
export interface TicketNoteAttributes {
  note: string;
  userId?: number | string;
  contactId?: number | string;
  ticketId?: number | string;
}

export interface PagedTicketNotesQuery {
  searchParam: string;
  limit: number;
  offset: number;
}

export interface PagedTicketNotesResult {
  ticketNotes: TicketNote[];
  count: number;
}

/**
 * Único ponto de acesso ao model do domínio (doc 04 §3): TicketNote. Não lança
 * erro de negócio — retorna dados/null e o service decide.
 */
export class TicketNotesRepository {
  public async create(attributes: TicketNoteAttributes): Promise<TicketNote> {
    return TicketNote.create(attributes);
  }

  public async findById(id: string | number): Promise<TicketNote | null> {
    return TicketNote.findByPk(id);
  }

  public async update(
    ticketNote: TicketNote,
    attributes: Partial<TicketNoteAttributes>
  ): Promise<TicketNote> {
    await ticketNote.update(attributes);

    return ticketNote;
  }

  public async delete(ticketNote: TicketNote): Promise<void> {
    await ticketNote.destroy();
  }

  public async findAll(): Promise<TicketNote[]> {
    return TicketNote.findAll();
  }

  /** Listagem paginada com busca textual case-insensitive na nota. */
  public async findAndCountPaged(
    query: PagedTicketNotesQuery
  ): Promise<PagedTicketNotesResult> {
    const { searchParam, limit, offset } = query;

    const { count, rows: ticketNotes } = await TicketNote.findAndCountAll({
      where: this.buildSearchWhere(searchParam),
      limit,
      offset,
      order: [["createdAt", "DESC"]]
    });

    return { ticketNotes, count };
  }

  // TODO(B3/B4): os includes tocam models de OUTROS domínios (User/Contact/
  // Ticket); mover o join para o repository de cada dono quando ele migrar.
  public async findByContactAndTicket(
    filters: FindNotesFilters
  ): Promise<TicketNote[]> {
    const { contactId, ticketId } = filters;

    return TicketNote.findAll({
      where: { contactId, ticketId },
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email"] },
        { model: Contact, as: "contact", attributes: ["id", "name"] },
        {
          model: Ticket,
          as: "ticket",
          attributes: ["id", "status", "createdAt"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });
  }

  /**
   * Busca sempre aplicada (mesmo com termo vazio → `LIKE '%%'` casa tudo),
   * preservando o comportamento original do ListTicketNotesService.
   */
  private buildSearchWhere(searchParam: string): WhereOptions {
    return {
      [Op.or]: [
        {
          note: Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("note")),
            "LIKE",
            `%${searchParam.toLowerCase().trim()}%`
          )
        }
      ]
    };
  }
}
