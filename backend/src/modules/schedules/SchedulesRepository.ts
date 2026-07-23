import { Op, Sequelize } from "sequelize";
import moment from "moment";

import Contact from "../contacts/models/Contact";
import User from "../users/models/User";
import Schedule from "./models/Schedule";

/** Atributos de criação de um agendamento (subset usado pelo domínio). */
export interface CreateScheduleAttributes {
  body: string;
  sendAt: string;
  contactId: number | string;
  companyId: number | string;
  userId?: number | string;
  status: string;
}

/** Campos atualizáveis de um agendamento (ausentes não mudam). */
export interface UpdateScheduleAttributes {
  body?: string;
  sendAt?: string;
  sentAt?: string;
  contactId?: number;
  ticketId?: number;
  userId?: number;
  /** Ciclo de vida do disparo (jobs): PENDENTE → AGENDADA → ENVIADA/ERRO. */
  status?: string;
}

export interface ScheduleSearchFilters {
  companyId: number;
  searchParam?: string;
  contactId?: number | string;
  userId?: number | string;
}

export interface PagedSchedulesQuery extends ScheduleSearchFilters {
  limit: number;
  offset: number;
}

export interface PagedSchedulesResult {
  schedules: Schedule[];
  count: number;
}

/**
 * Único ponto de acesso ao model Schedule (doc 04 §3). Não emite socket nem
 * lança erro de negócio — retorna dados/null e o service decide.
 *
 * Os includes de Contact/User são associações próprias do Schedule (o
 * agendamento sempre é a entidade primária), então ficam aqui como includes,
 * não como acesso a outro domínio.
 */
export class SchedulesRepository {
  public async create(attributes: CreateScheduleAttributes): Promise<Schedule> {
    const schedule = await Schedule.create(attributes);
    await schedule.reload();

    return schedule;
  }

  public async findById(id: string | number): Promise<Schedule | null> {
    return Schedule.findByPk(id);
  }

  public async findByIdWithRelations(
    id: string | number
  ): Promise<Schedule | null> {
    return Schedule.findByPk(id, {
      include: [
        { model: Contact, as: "contact", attributes: ["id", "name"] },
        { model: User, as: "user", attributes: ["id", "name"] }
      ]
    });
  }

  public async findByIdAndCompany(
    id: string | number,
    companyId: number
  ): Promise<Schedule | null> {
    return Schedule.findOne({ where: { id, companyId } });
  }

  public async update(
    schedule: Schedule,
    attributes: UpdateScheduleAttributes
  ): Promise<Schedule> {
    await schedule.update(attributes);
    await schedule.reload();

    return schedule;
  }

  public async save(schedule: Schedule): Promise<void> {
    await schedule.save();
  }

  /**
   * Atualização SEM reload — usada pelos jobs de disparo (o fluxo original em
   * queues/scheduleJobs.ts não recarregava a instância).
   */
  public async updateForDispatch(
    schedule: Schedule,
    attributes: UpdateScheduleAttributes
  ): Promise<void> {
    await schedule.update(attributes);
  }

  /**
   * Agendamentos PENDENTE ainda não enviados com disparo até 30s à frente
   * (poller do ScheduleMonitor) — query idêntica à do antigo scheduleJobs.
   */
  public async findAndCountPendingDue(): Promise<{
    count: number;
    schedules: Schedule[];
  }> {
    const { count, rows: schedules } = await Schedule.findAndCountAll({
      where: {
        status: "PENDENTE",
        sentAt: null,
        sendAt: {
          [Op.lte]: moment().add("30", "seconds").format("YYYY-MM-DD HH:mm:ss")
        }
      },
      include: [{ model: Contact, as: "contact" }]
    });

    return { count, schedules };
  }

  public async delete(schedule: Schedule): Promise<void> {
    await schedule.destroy();
  }

  /** Listagem paginada com filtros de busca/contato/usuário (tela de Schedules). */
  public async findAndCountAll(
    query: PagedSchedulesQuery
  ): Promise<PagedSchedulesResult> {
    const { companyId, searchParam, contactId, userId, limit, offset } = query;

    const { count, rows: schedules } = await Schedule.findAndCountAll({
      // companyId como escalar: SQL idêntico ao `{ [Op.eq]: companyId }` do
      // ListService original (`companyId = X`); forma idiomática do template.
      where: {
        ...this.buildFilterWhere({ searchParam, contactId, userId }),
        companyId
      },
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        { model: Contact, as: "contact", attributes: ["id", "name"] },
        { model: User, as: "user", attributes: ["id", "name"] }
      ]
    });

    return { schedules, count };
  }

  /**
   * Monta os filtros opcionais (busca/contato/usuário). O `companyId` é
   * adicionado no call site (sempre presente), como no ListService original.
   */
  private buildFilterWhere(
    filters: Omit<ScheduleSearchFilters, "companyId">
  ): object {
    const { searchParam, contactId = "", userId = "" } = filters;
    let whereCondition: object = {};

    if (searchParam) {
      whereCondition = {
        [Op.or]: [
          {
            "$Schedule.body$": Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("Schedule.body")),
              "LIKE",
              `%${searchParam.toLowerCase()}%`
            )
          },
          {
            "$Contact.name$": Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("contact.name")),
              "LIKE",
              `%${searchParam.toLowerCase()}%`
            )
          }
        ]
      };
    }

    if (contactId !== "") {
      whereCondition = { ...whereCondition, contactId };
    }

    if (userId !== "") {
      whereCondition = { ...whereCondition, userId };
    }

    return whereCondition;
  }
}
