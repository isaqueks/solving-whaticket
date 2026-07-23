import { Op, col, fn } from "sequelize";

import { LinkTicketTagDto } from "./dtos/LinkTicketTagDto";
import Tag from "./models/Tag";
import TicketTag from "./models/TicketTag";

/** Atributos persistíveis de Tag (subset usado pelo domínio). */
export interface TagAttributes {
  name: string;
  color: string;
  kanban: number;
  companyId: number;
}

export interface TagSearchFilters {
  companyId: number;
  searchParam?: string;
}

export interface PagedTagsQuery extends TagSearchFilters {
  limit: number;
  offset: number;
}

export interface PagedTagsResult {
  tags: Tag[];
  count: number;
}

/**
 * Único ponto de acesso aos models do domínio (doc 04 §3): Tag e TicketTag.
 * Não emite socket nem lança erro de negócio — retorna dados/null e o
 * service decide.
 */
export class TagsRepository {
  /** Cria a tag se não existir combinação idêntica (comportamento original). */
  public async findOrCreate(attributes: TagAttributes): Promise<Tag> {
    const [tag] = await Tag.findOrCreate({
      where: { ...attributes },
      defaults: { ...attributes }
    });

    await tag.reload();

    return tag;
  }

  public async findById(id: string | number): Promise<Tag | null> {
    return Tag.findByPk(id);
  }

  public async update(
    tag: Tag,
    attributes: Partial<TagAttributes>
  ): Promise<Tag> {
    await tag.update(attributes);
    await tag.reload();

    return tag;
  }

  public async delete(tag: Tag): Promise<void> {
    await tag.destroy();
  }

  /** Listagem paginada com contagem de tickets por tag (tela de Tags). */
  public async findAndCountWithTicketsCount(
    query: PagedTagsQuery
  ): Promise<PagedTagsResult> {
    const { companyId, searchParam, limit, offset } = query;

    const { count, rows: tags } = await Tag.findAndCountAll({
      where: { ...this.buildSearchWhere(searchParam), companyId },
      limit,
      offset,
      order: [["name", "ASC"]],
      subQuery: false,
      include: [
        {
          model: TicketTag,
          as: "ticketTags",
          attributes: [],
          required: false
        }
      ],
      attributes: [
        "id",
        "name",
        "color",
        [fn("count", col("ticketTags.tagId")), "ticketsCount"]
      ],
      group: ["Tag.id"]
    });

    return { tags, count };
  }

  public async findAllByCompany(filters: TagSearchFilters): Promise<Tag[]> {
    const { companyId, searchParam } = filters;

    return Tag.findAll({
      where: { ...this.buildSearchWhere(searchParam), companyId },
      order: [["name", "ASC"]]
    });
  }

  public async findKanbanByCompany(companyId: number): Promise<Tag[]> {
    return Tag.findAll({
      where: { kanban: 1, companyId },
      order: [["id", "ASC"]],
      raw: true
    });
  }

  // ── Junção ticket↔tag (absorvida do TicketTagController na B2) ─────────────
  // Este repository já é o único ponto de acesso aos models Tag e TicketTag,
  // então as operações da junção vivem aqui (doc 04 §3) em vez de um segundo
  // repository tocando os mesmos models.

  /** Vincula uma tag a um ticket (uma linha na tabela de junção). */
  public async addTicketTag(dto: LinkTicketTagDto): Promise<TicketTag> {
    const { ticketId, tagId } = dto;
    return TicketTag.create({ ticketId, tagId });
  }

  /** Todas as associações tag↔ticket de um ticket. */
  public async findTicketTags(ticketId: string): Promise<TicketTag[]> {
    return TicketTag.findAll({ where: { ticketId } });
  }

  /** Todas as associações de uma tag (fluxo campanha-por-tag, B6). */
  public async findTicketTagsByTagId(tagId: number): Promise<TicketTag[]> {
    return TicketTag.findAll({ where: { tagId } });
  }

  /** Dentre os ids informados, os que pertencem a tags de kanban (kanban=1). */
  public async findKanbanTagIds(tagIds: number[]): Promise<number[]> {
    const tags = await Tag.findAll({ where: { id: tagIds, kanban: 1 } });
    return tags.map(tag => tag.id);
  }

  /** Remove, do ticket, as associações das tags informadas. */
  public async destroyTicketTags(
    ticketId: string,
    tagIds: number[]
  ): Promise<void> {
    await TicketTag.destroy({ where: { ticketId, tagId: tagIds } });
  }

  /** Substitui o conjunto de tags do ticket (destroy + bulkCreate, como antes). */
  public async replaceTicketTags(
    ticketId: number,
    tagIds: number[]
  ): Promise<void> {
    await TicketTag.destroy({ where: { ticketId } });
    await TicketTag.bulkCreate(tagIds.map(tagId => ({ tagId, ticketId })));
  }

  private buildSearchWhere(searchParam?: string): object {
    if (!searchParam) {
      return {};
    }

    return {
      [Op.or]: [
        { name: { [Op.like]: `%${searchParam}%` } },
        { color: { [Op.like]: `%${searchParam}%` } }
      ]
    };
  }
}
