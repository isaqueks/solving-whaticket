import { Sequelize, Op, WhereOptions } from "sequelize";

import { CreateHelpDto } from "./dtos/CreateHelpDto";
import { UpdateHelpDto } from "./dtos/UpdateHelpDto";
import Help from "./models/Help";

export interface PagedHelpsQuery {
  searchParam?: string;
  limit: number;
  offset: number;
}

export interface PagedHelpsResult {
  records: Help[];
  count: number;
}

/**
 * Único ponto de acesso ao model do domínio (doc 04 §3): Help.
 * Não emite socket nem lança erro de negócio — retorna dados/null e o
 * service decide.
 */
export class HelpRepository {
  public async create(dto: CreateHelpDto): Promise<Help> {
    return Help.create(dto);
  }

  public async findById(id: string | number): Promise<Help | null> {
    return Help.findByPk(id);
  }

  public async update(record: Help, dto: UpdateHelpDto): Promise<Help> {
    await record.update(dto);

    return record;
  }

  public async delete(record: Help): Promise<void> {
    await record.destroy();
  }

  /** Listagem paginada da tela de Ajuda (busca por título, case-insensitive). */
  public async findAndCountBySearch(
    query: PagedHelpsQuery
  ): Promise<PagedHelpsResult> {
    const { searchParam, limit, offset } = query;

    const { count, rows: records } = await Help.findAndCountAll({
      where: this.buildSearchWhere(searchParam),
      limit,
      offset,
      order: [["title", "ASC"]]
    });

    return { records, count };
  }

  /** Lista plana ordenada por título (absorve FindService/FindAllService). */
  public async findAllOrderedByTitle(): Promise<Help[]> {
    return Help.findAll({
      order: [["title", "ASC"]]
    });
  }

  private buildSearchWhere(searchParam = ""): WhereOptions {
    return {
      [Op.or]: [
        {
          title: Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("title")),
            "LIKE",
            `%${searchParam.toLowerCase().trim()}%`
          )
        }
      ]
    };
  }
}
