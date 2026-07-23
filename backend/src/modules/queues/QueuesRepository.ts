import { Op } from "sequelize";

import Company from "../companies/models/Company";
import Plan from "../plans/models/Plan";
import { CreateQueueDto } from "./dtos/CreateQueueDto";
import Queue from "./models/Queue";
import QueueOption from "./models/QueueOption";

/** Atributos persistíveis de Queue (subset usado pelo domínio). */
export interface QueueAttributes {
  name: string;
  color: string;
  greetingMessage: string;
  outOfHoursMessage: string;
  schedules: unknown[];
  orderQueue: number | null;
  integrationId: number | null;
  promptId: number | null;
  mediaPath: string | null;
  mediaName: string | null;
}

/**
 * Único ponto de acesso ao model Queue (doc 04 §3). Não emite socket nem lança
 * erro de negócio — retorna dados/null e o service decide.
 */
export class QueuesRepository {
  public async findAllByCompany(companyId: number): Promise<Queue[]> {
    return Queue.findAll({
      where: { companyId },
      order: [["orderQueue", "ASC"]]
    });
  }

  /**
   * Fila com as opções de primeiro nível (parentId nulo) — árvore do chatbot
   * do wbot (módulo whatsapp-session, B5). Query idêntica ao bloco inline do
   * antigo handleChartbot.
   */
  public async findByIdWithRootOptions(
    id: string | number
  ): Promise<Queue | null> {
    return Queue.findByPk(id, {
      include: [
        {
          model: QueueOption,
          as: "options",
          where: { parentId: null },
          order: [
            ["option", "ASC"],
            ["createdAt", "ASC"]
          ]
        }
      ]
    });
  }

  public async findById(id: string | number): Promise<Queue | null> {
    return Queue.findByPk(id);
  }

  public async countByCompany(companyId: number): Promise<number> {
    return Queue.count({ where: { companyId } });
  }

  /**
   * Fila com o mesmo nome na empresa. `excludeId` (update) ignora a própria
   * fila via `Op.ne`.
   */
  public async findByNameInCompany(
    name: string,
    companyId: number,
    excludeId?: string | number
  ): Promise<Queue | null> {
    return Queue.findOne({
      where: {
        name,
        companyId,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {})
      }
    });
  }

  /** Fila com a mesma cor na empresa (mesma regra de `excludeId`). */
  public async findByColorInCompany(
    color: string,
    companyId: number,
    excludeId?: string | number
  ): Promise<Queue | null> {
    return Queue.findOne({
      where: {
        color,
        companyId,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {})
      }
    });
  }

  public async create(dto: CreateQueueDto): Promise<Queue> {
    return Queue.create(dto);
  }

  public async update(
    queue: Queue,
    attributes: Partial<QueueAttributes>
  ): Promise<Queue> {
    await queue.update(attributes);

    return queue;
  }

  public async delete(queue: Queue): Promise<void> {
    await queue.destroy();
  }

  // TODO(B3/Companies-Plans): mover para o repository de Companies/Plans quando
  // esse domínio migrar — hoje o limite de filas por plano é lido aqui.
  public async findCompanyWithPlan(companyId: number): Promise<Company | null> {
    return Company.findOne({
      where: { id: companyId },
      include: [{ model: Plan, as: "plan" }]
    });
  }
}
