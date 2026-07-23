import { Filterable, Sequelize } from "sequelize";

import Company from "../companies/models/Company";
import { CreateQuickMessageDto } from "./dtos/CreateQuickMessageDto";
import QuickMessage from "./models/QuickMessage";

/** Atributos mutáveis de QuickMessage (subset tocado pelo domínio). */
export interface QuickMessageUpdateAttributes {
  shortcode?: string;
  message?: string;
  userId?: number | string;
  mediaPath?: string | null;
  mediaName?: string | null;
}

export interface PagedQuickMessagesQuery {
  companyId: number | string;
  userId?: number | string;
  /** Já normalizado (lower + trim) pelo service. */
  searchParam: string;
  limit: number;
  offset: number;
}

export interface PagedQuickMessagesResult {
  records: QuickMessage[];
  count: number;
}

export interface FindQuickMessagesQuery {
  companyId: string;
  userId: string;
}

/**
 * Único ponto de acesso ao model QuickMessage (doc 04 §3). Não emite socket
 * nem lança erro de negócio — retorna dados/null e o service decide.
 */
export class QuickMessagesRepository {
  public async create(attributes: CreateQuickMessageDto): Promise<QuickMessage> {
    return QuickMessage.create(attributes);
  }

  public async findById(id: string | number): Promise<QuickMessage | null> {
    return QuickMessage.findByPk(id);
  }

  public async update(
    record: QuickMessage,
    attributes: QuickMessageUpdateAttributes
  ): Promise<QuickMessage> {
    await record.update(attributes);

    return record;
  }

  public async delete(record: QuickMessage): Promise<void> {
    await record.destroy();
  }

  /** Listagem paginada com busca case-insensitive por shortcode (tela). */
  public async findAndCountPaged(
    query: PagedQuickMessagesQuery
  ): Promise<PagedQuickMessagesResult> {
    const { companyId, userId, searchParam, limit, offset } = query;

    const whereCondition: Filterable["where"] = {
      shortcode: Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("shortcode")),
        "LIKE",
        `%${searchParam}%`
      ),
      companyId,
      userId
    };

    const { count, rows: records } = await QuickMessage.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["shortcode", "ASC"]]
    });

    return { records, count };
  }

  /** Lista plana por empresa+usuário, com a empresa embutida (endpoint /list). */
  public async findAllByCompanyAndUser(
    query: FindQuickMessagesQuery
  ): Promise<QuickMessage[]> {
    const { companyId, userId } = query;

    return QuickMessage.findAll({
      where: { companyId, userId },
      include: [{ model: Company, as: "company", attributes: ["id", "name"] }],
      order: [["shortcode", "ASC"]]
    });
  }
}
