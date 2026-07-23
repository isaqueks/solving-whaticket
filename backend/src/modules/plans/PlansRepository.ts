import { Op, Sequelize } from "sequelize";

import Plan from "./models/Plan";

/** Atributos persistíveis de Plan (subset gravado por create/update). */
export interface PlanWritableAttributes {
  name?: string;
  users?: number;
  connections?: number;
  queues?: number;
  value?: number;
  useCampaigns?: boolean;
  useSchedules?: boolean;
  useInternalChat?: boolean;
  useExternalApi?: boolean;
  useKanban?: boolean;
  useOpenAi?: boolean;
  useIntegrations?: boolean;
}

export interface PagedPlansQuery {
  searchParam: string;
  limit: number;
  offset: number;
}

export interface PagedPlansResult {
  plans: Plan[];
  count: number;
}

/**
 * Único ponto de acesso ao model Plan do domínio (doc 04 §3). Não emite socket
 * nem lança erro de negócio — retorna dados/null e o service decide.
 */
export class PlansRepository {
  public async findById(id: string | number): Promise<Plan | null> {
    return Plan.findByPk(id);
  }

  public async findByName(name: string): Promise<Plan | null> {
    return Plan.findOne({ where: { name } });
  }

  public async findAllOrderedByName(): Promise<Plan[]> {
    return Plan.findAll({ order: [["name", "ASC"]] });
  }

  public async create(attributes: PlanWritableAttributes): Promise<Plan> {
    return Plan.create(attributes);
  }

  public async update(
    plan: Plan,
    attributes: PlanWritableAttributes
  ): Promise<Plan> {
    await plan.update(attributes);

    return plan;
  }

  public async delete(plan: Plan): Promise<void> {
    await plan.destroy();
  }

  /** Listagem paginada com busca case-insensitive no nome (tela de Planos). */
  public async findAndCountPaged(
    query: PagedPlansQuery
  ): Promise<PagedPlansResult> {
    const { searchParam, limit, offset } = query;

    const { count, rows: plans } = await Plan.findAndCountAll({
      where: { ...this.buildSearchWhere(searchParam) },
      limit,
      offset,
      order: [["name", "ASC"]]
    });

    return { plans, count };
  }

  /**
   * Filtro de busca por nome (LOWER + LIKE). Retorna `object` para isolar os
   * operadores do Sequelize (typings v5) do contrato tipado de `where`.
   */
  private buildSearchWhere(searchParam: string): object {
    return {
      [Op.or]: [
        {
          name: Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("name")),
            "LIKE",
            `%${searchParam.toLowerCase().trim()}%`
          )
        }
      ]
    };
  }
}
