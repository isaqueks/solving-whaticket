import { Filterable, Op, col, fn, where } from "sequelize";

import Company from "../companies/models/Company";
import { CreateAnnouncementDto } from "./dtos/CreateAnnouncementDto";
import Announcement from "./models/Announcement";

/** Atributos mutáveis de Announcement (subset tocado pelo domínio). */
export interface AnnouncementUpdateAttributes {
  priority?: number;
  title?: string;
  text?: string;
  status?: boolean;
  mediaPath?: string | null;
  mediaName?: string | null;
}

export interface PagedAnnouncementsQuery {
  searchParam?: string;
  limit: number;
  offset: number;
}

export interface PagedAnnouncementsResult {
  records: Announcement[];
  count: number;
}

/**
 * Único ponto de acesso ao model Announcement (doc 04 §3). Não emite socket
 * nem lança erro de negócio — retorna dados/null e o service decide.
 */
export class AnnouncementsRepository {
  public async create(attributes: CreateAnnouncementDto): Promise<Announcement> {
    return Announcement.create(attributes);
  }

  public async findById(id: string | number): Promise<Announcement | null> {
    return Announcement.findByPk(id);
  }

  public async update(
    record: Announcement,
    attributes: AnnouncementUpdateAttributes
  ): Promise<Announcement> {
    await record.update(attributes);
    await record.reload();

    return record;
  }

  public async delete(record: Announcement): Promise<void> {
    await record.destroy();
  }

  /** Listagem paginada por status, busca case-insensitive por título (tela). */
  public async findAndCountPaged(
    query: PagedAnnouncementsQuery
  ): Promise<PagedAnnouncementsResult> {
    const { searchParam, limit, offset } = query;

    const { count, rows: records } = await Announcement.findAndCountAll({
      where: this.buildSearchWhere(searchParam),
      limit,
      offset,
      order: [["createdAt", "DESC"]]
    });

    return { records, count };
  }

  /** Lista plana por empresa, com a empresa embutida (endpoint /list). */
  public async findAllByCompany(companyId: string): Promise<Announcement[]> {
    return Announcement.findAll({
      where: { companyId },
      include: [{ model: Company, as: "company", attributes: ["id", "name"] }],
      order: [["createdAt", "DESC"]]
    });
  }

  private buildSearchWhere(searchParam?: string): Filterable["where"] {
    const base: Filterable["where"] = { status: true };

    if (!searchParam) {
      return base;
    }

    return {
      ...base,
      [Op.or]: [
        {
          title: where(
            fn("LOWER", col("Announcement.title")),
            "LIKE",
            `%${searchParam.toLowerCase().trim()}%`
          )
        }
      ]
    };
  }
}
