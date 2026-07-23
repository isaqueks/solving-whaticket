import AppError from "../../shared/errors/AppError";
import { CreateTicketNoteDto } from "./dtos/CreateTicketNoteDto";
import { FindNotesFilters } from "./dtos/FindNotesFilters";
import {
  ListTicketNotesFilters,
  ListTicketNotesResult
} from "./dtos/ListTicketNotesFilters";
import { UpdateTicketNoteDto } from "./dtos/UpdateTicketNoteDto";
import TicketNote from "./models/TicketNote";
import { TicketNotesRepository } from "./TicketNotesRepository";

/** Página fixa da listagem (comportamento original do ListService). */
const LIST_PAGE_SIZE = 20;

/**
 * Casos de uso do domínio TicketNotes (doc 04 §§2–3). Absorve os 7 arquivos do
 * antigo `services/TicketNoteService/`. Regras e códigos de erro preservados
 * (`ERR_NO_TICKETNOTE_FOUND`). O domínio não emite eventos de socket.
 */
export class TicketNotesService {
  constructor(private readonly repository = new TicketNotesRepository()) {}

  public async list(
    filters: ListTicketNotesFilters
  ): Promise<ListTicketNotesResult> {
    const { searchParam = "", pageNumber = "1" } = filters;
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { ticketNotes, count } = await this.repository.findAndCountPaged({
      searchParam,
      limit,
      offset
    });

    const hasMore = count > offset + ticketNotes.length;

    return { ticketNotes, count, hasMore };
  }

  public async findAll(): Promise<TicketNote[]> {
    return this.repository.findAll();
  }

  public async create(dto: CreateTicketNoteDto): Promise<TicketNote> {
    return this.repository.create(dto);
  }

  public async show(id: string | number): Promise<TicketNote> {
    return this.findByIdOrFail(id);
  }

  public async update(
    id: string | number,
    dto: UpdateTicketNoteDto
  ): Promise<TicketNote> {
    const ticketNote = await this.findByIdOrFail(id);

    return this.repository.update(ticketNote, { note: dto.note });
  }

  public async delete(id: string | number): Promise<void> {
    const ticketNote = await this.findByIdOrFail(id);

    await this.repository.delete(ticketNote);
  }

  public async findByContactAndTicket(
    filters: FindNotesFilters
  ): Promise<TicketNote[]> {
    return this.repository.findByContactAndTicket(filters);
  }

  private async findByIdOrFail(id: string | number): Promise<TicketNote> {
    const ticketNote = await this.repository.findById(id);
    if (!ticketNote) {
      throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
    }

    return ticketNote;
  }
}
