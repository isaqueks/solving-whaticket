import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { CreateTagDto } from "./dtos/CreateTagDto";
import { LinkTicketTagDto } from "./dtos/LinkTicketTagDto";
import { ListTagsFilters, ListTagsResult } from "./dtos/ListTagsFilters";
import { SimpleListTagsFilters } from "./dtos/SimpleListTagsFilters";
import { SyncTagsDto } from "./dtos/SyncTagsDto";
import { UpdateTagDto } from "./dtos/UpdateTagDto";
import Ticket from "../tickets/models/Ticket";
import { TicketsRepository } from "../tickets/TicketsRepository";
import Tag from "./models/Tag";
import TicketTag from "./models/TicketTag";
import { TagsRepository } from "./TagsRepository";

/** Página fixa da listagem (comportamento original do ListService). */
const LIST_PAGE_SIZE = 5000;

/**
 * Casos de uso do domínio Tags (doc 04 §§2–3). Absorve os 8 arquivos do
 * antigo `services/TagServices/`. Regras de negócio preservadas; eventos de
 * domínio emitidos via RealtimeGateway (nunca `io.to` direto).
 */
export class TagsService {
  constructor(
    private readonly repository = new TagsRepository(),
    private readonly ticketsRepository = new TicketsRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async create(dto: CreateTagDto): Promise<Tag> {
    const { name, color = "#A4CCCC", kanban = 0, companyId } = dto;

    const tag = await this.repository.findOrCreate({
      name,
      color,
      kanban,
      companyId
    });

    this.emitTagEvent(companyId, { action: "create", tag });

    return tag;
  }

  public async update(
    id: string | number,
    dto: UpdateTagDto,
    companyId: number
  ): Promise<Tag> {
    const tag = await this.show(id);
    const { name, color, kanban } = dto;

    const updated = await this.repository.update(tag, { name, color, kanban });

    this.emitTagEvent(companyId, { action: "update", tag: updated });

    return updated;
  }

  public async delete(id: string | number, companyId: number): Promise<void> {
    const tag = await this.show(id);

    await this.repository.delete(tag);

    this.emitTagEvent(companyId, { action: "delete", tagId: id });
  }

  public async show(id: string | number): Promise<Tag> {
    const tag = await this.repository.findById(id);
    if (!tag) {
      throw new AppError("ERR_NO_TAG_FOUND", 404);
    }

    return tag;
  }

  public async list(filters: ListTagsFilters): Promise<ListTagsResult> {
    const { companyId, searchParam, pageNumber = "1" } = filters;
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { tags, count } = await this.repository.findAndCountWithTicketsCount({
      companyId,
      searchParam,
      limit,
      offset
    });

    const hasMore = count > offset + tags.length;

    return { tags, count, hasMore };
  }

  public async kanbanList(companyId: number): Promise<Tag[]> {
    return this.repository.findKanbanByCompany(companyId);
  }

  public async simpleList(filters: SimpleListTagsFilters): Promise<Tag[]> {
    return this.repository.findAllByCompany(filters);
  }

  public async syncTags(dto: SyncTagsDto): Promise<Ticket | null> {
    const { ticketId, tags } = dto;

    const ticket = await this.ticketsRepository.findWithTags(ticketId);

    await this.repository.replaceTicketTags(
      ticketId,
      tags.map(tag => tag.id)
    );

    if (ticket) {
      // Reload disparado sem await — comportamento original preservado
      // (o ticket retornado pode ainda refletir as tags antigas).
      this.ticketsRepository.reload(ticket);
    }

    return ticket;
  }

  // ── Junção ticket↔tag (absorvida do TicketTagController na B2) ─────────────

  /** Vincula uma tag a um ticket (rota PUT /ticket-tags/:ticketId/:tagId). */
  public async linkTag(dto: LinkTicketTagDto): Promise<TicketTag> {
    return this.repository.addTicketTag(dto);
  }

  /**
   * Remove do ticket apenas as tags de kanban (kanban=1) — comportamento
   * original do TicketTagController.remove: as demais tags do ticket ficam.
   */
  public async removeKanbanTags(ticketId: string): Promise<void> {
    const ticketTags = await this.repository.findTicketTags(ticketId);
    const tagIds = ticketTags.map(ticketTag => ticketTag.tagId);

    const kanbanTagIds = await this.repository.findKanbanTagIds(tagIds);
    if (!kanbanTagIds.length) {
      return;
    }

    await this.repository.destroyTicketTags(ticketId, kanbanTagIds);
  }

  private emitTagEvent(companyId: number, payload: unknown): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyTag(companyId),
      payload
    );
  }
}
