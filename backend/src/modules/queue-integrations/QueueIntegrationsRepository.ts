import { Filterable, Op, Sequelize } from "sequelize";

import { CreateQueueIntegrationDto } from "./dtos/CreateQueueIntegrationDto";
import QueueIntegrations from "./models/QueueIntegrations";

/** Atributos gravados no update (dto + companyId, como no legado). */
export interface QueueIntegrationWritableAttributes {
  type?: string;
  name?: string;
  projectName?: string;
  jsonContent?: string;
  language?: string;
  urlN8N?: string;
  companyId?: number;
  typebotSlug?: string;
  typebotExpires?: number;
  typebotKeywordFinish?: string;
  typebotUnknownMessage?: string;
  typebotDelayMessage?: number;
  typebotKeywordRestart?: string;
  typebotRestartMessage?: string;
}

export interface PagedQueueIntegrationsQuery {
  searchParam: string;
  companyId: number;
  limit: number;
  offset: number;
}

export interface PagedQueueIntegrationsResult {
  queueIntegrations: QueueIntegrations[];
  count: number;
}

/**
 * Único ponto de acesso ao model QueueIntegrations (doc 04 §3). Não emite
 * socket nem lança erro de negócio — retorna dados/null e o service decide.
 */
export class QueueIntegrationsRepository {
  public async findById(
    id: string | number
  ): Promise<QueueIntegrations | null> {
    return QueueIntegrations.findByPk(id);
  }

  /** Usada na validação de nome único por empresa (create). */
  public async findByNameAndCompany(
    name: string,
    companyId: number
  ): Promise<QueueIntegrations | null> {
    return QueueIntegrations.findOne({
      where: { name, companyId }
    });
  }

  public async create(
    dto: CreateQueueIntegrationDto
  ): Promise<QueueIntegrations> {
    // Typings do Sequelize v5 não modelam atributos de criação — cast
    // confinado ao repository (doc 04 §4).
    return QueueIntegrations.create(dto as Partial<QueueIntegrations>);
  }

  public async updateInstance(
    integration: QueueIntegrations,
    attributes: QueueIntegrationWritableAttributes
  ): Promise<QueueIntegrations> {
    return integration.update(attributes);
  }

  public async destroy(integration: QueueIntegrations): Promise<void> {
    await integration.destroy();
  }

  /**
   * Listagem paginada com busca case-insensitive por nome — where montado na
   * MESMA ordem do ListQueueIntegrationService original.
   */
  public async findAndCountPaged(
    query: PagedQueueIntegrationsQuery
  ): Promise<PagedQueueIntegrationsResult> {
    const { searchParam, companyId, limit, offset } = query;

    let whereCondition: Filterable["where"] = {
      [Op.or]: [
        {
          "$QueueIntegrations.name$": Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("QueueIntegrations.name")),
            "LIKE",
            `%${searchParam.toLowerCase()}%`
          )
        }
      ]
    };

    whereCondition = {
      ...whereCondition,
      companyId
    };

    const { count, rows: queueIntegrations } =
      await QueueIntegrations.findAndCountAll({
        where: whereCondition,
        limit,
        offset,
        order: [["createdAt", "DESC"]]
      });

    return { queueIntegrations, count };
  }
}
