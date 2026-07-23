import { WhereOptions } from "sequelize/types";

import { CreateQueueOptionDto } from "./dtos/CreateQueueOptionDto";
import { ListQueueOptionsFilters } from "./dtos/ListQueueOptionsFilters";
import QueueOption from "./models/QueueOption";

/** Atributos persistíveis de QueueOption (subset usado pelo domínio). */
export interface QueueOptionAttributes {
  queueId: string | number;
  title: string;
  option: string;
  message: string;
  parentId: string | number;
  mediaPath: string | null;
  mediaName: string | null;
}

/**
 * Único ponto de acesso ao model QueueOption (doc 04 §3). Não emite socket nem
 * lança erro de negócio — retorna dados/null e o service decide.
 */
export class QueueOptionsRepository {
  /**
   * Listagem filtrada por fila/opção/pai. Preserva a semântica do ListService
   * legado: `parentId == -1` traz apenas nós raiz (parentId nulo); `> 0` filtra
   * pelos filhos daquele pai. Number() evita o TS2365 do boolean da união e
   * mantém as mesmas conversões do legado.
   */
  public async findAllFiltered(
    filters: ListQueueOptionsFilters
  ): Promise<QueueOption[]> {
    const { queueId, queueOptionId, parentId } = filters;
    const whereOptions: WhereOptions = {};

    if (queueId) {
      whereOptions.queueId = queueId;
    }

    if (queueOptionId) {
      whereOptions.id = queueOptionId;
    }

    const parentIdValue = Number(parentId);
    if (parentIdValue === -1) {
      whereOptions.parentId = null;
    }

    if (parentIdValue > 0) {
      whereOptions.parentId = parentId;
    }

    return QueueOption.findAll({
      where: whereOptions,
      order: [["id", "ASC"]]
    });
  }

  /** Opção com o include self-referencial `parent` (comportamento original). */
  public async findByIdWithParent(
    id: string | number
  ): Promise<QueueOption | null> {
    return QueueOption.findOne({
      where: { id },
      include: [
        {
          model: QueueOption,
          as: "parent",
          where: { parentId: id },
          required: false
        }
      ]
    });
  }

  // ── Consultas do fluxo de chatbot do wbot (módulo whatsapp-session, B5) ────

  public async findById(id: string | number): Promise<QueueOption | null> {
    return QueueOption.findByPk(id);
  }

  public async countByParent(parentId: string | number): Promise<number> {
    return QueueOption.count({
      where: { parentId }
    });
  }

  public async findOneByParent(
    parentId: string | number
  ): Promise<QueueOption | null> {
    return QueueOption.findOne({
      where: { parentId }
    });
  }

  public async findOneByOptionAndParent(
    option: string,
    parentId: string | number
  ): Promise<QueueOption | null> {
    return QueueOption.findOne({
      where: {
        option,
        parentId
      }
    });
  }

  /** Opções raiz da fila, na ordem do menu do chatbot. */
  public async findRootsByQueue(
    queueId: string | number
  ): Promise<QueueOption[]> {
    return QueueOption.findAll({
      where: { queueId, parentId: null },
      order: [
        ["option", "ASC"],
        ["createdAt", "ASC"]
      ]
    });
  }

  /** Sub-opções de um nó, na ordem do menu do chatbot. */
  public async findChildrenOrdered(
    parentId: string | number
  ): Promise<QueueOption[]> {
    return QueueOption.findAll({
      where: { parentId },
      order: [
        ["option", "ASC"],
        ["createdAt", "ASC"]
      ]
    });
  }

  public async create(dto: CreateQueueOptionDto): Promise<QueueOption> {
    return QueueOption.create(dto);
  }

  public async update(
    queueOption: QueueOption,
    attributes: Partial<QueueOptionAttributes>
  ): Promise<QueueOption> {
    await queueOption.update(attributes);

    return queueOption;
  }

  public async delete(queueOption: QueueOption): Promise<void> {
    await queueOption.destroy();
  }
}
