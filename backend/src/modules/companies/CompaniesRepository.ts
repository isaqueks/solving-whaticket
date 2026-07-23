import { Op, QueryTypes, Sequelize } from "sequelize";

import sequelize from "../../database";
// TODO(B?): Setting/User são de outros domínios (settings/users) — o seeding de
// settings e a criação do usuário admin deveriam migrar para um seeder do módulo
// settings quando o fluxo de onboarding for revisto (follow-up documentado:
// envolver create + user + seeds numa transação).
import Setting from "../settings/models/Setting";
import User from "../users/models/User";
import Plan from "../plans/models/Plan";
import Company from "./models/Company";

/** Atributos persistíveis de Company (subset gravado por create/update). */
export interface CompanyWritableAttributes {
  name?: string;
  phone?: string;
  email?: string;
  status?: boolean;
  planId?: number;
  dueDate?: string;
  recurrence?: string;
}

export interface AdminUserSeed {
  name: string;
  email: string;
  password: string;
  companyId: number;
}

export interface PagedCompaniesQuery {
  searchParam: string;
  limit: number;
  offset: number;
}

export interface PagedCompaniesResult {
  companies: Company[];
  count: number;
}

/** Linha retornada pela checagem de expediente atual (raw SQL). */
export interface CurrentSchedule {
  id: number;
  currentSchedule: [];
  startTime: string;
  endTime: string;
  inActivity: boolean;
}

/** Seeds de Setting criados junto com uma nova empresa (idempotente). */
const DEFAULT_SETTING_SEEDS: ReadonlyArray<{ key: string; value: string }> = [
  { key: "asaas", value: "" },
  { key: "tokenixc", value: "" },
  { key: "ipixc", value: "" },
  { key: "ipmkauth", value: "" },
  { key: "clientsecretmkauth", value: "" },
  { key: "clientidmkauth", value: "" },
  { key: "CheckMsgIsGroup", value: "" },
  { key: "call", value: "disabled" },
  { key: "scheduleType", value: "disabled" },
  { key: "sendGreetingAccepted", value: "disabled" },
  { key: "sendMsgTransfTicket", value: "disabled" },
  { key: "userRating", value: "disabled" },
  { key: "chatBotType", value: "text" },
  { key: "tokensgp", value: "" },
  { key: "ipsgp", value: "" },
  { key: "appsgp", value: "" }
];

/**
 * Único ponto de acesso ao model Company do domínio (doc 04 §3). Não emite socket
 * nem lança erro de negócio — retorna dados/null e o service decide.
 *
 * Alguns métodos tocam models de OUTROS domínios (User/Setting no onboarding) ou
 * o model Plan (co-migrado nesta wave): marcados/importados explicitamente.
 */
export class CompaniesRepository {
  public async findById(id: string | number): Promise<Company | null> {
    return Company.findByPk(id);
  }

  public async findByName(name: string): Promise<Company | null> {
    return Company.findOne({ where: { name } });
  }

  public async create(
    attributes: CompanyWritableAttributes
  ): Promise<Company> {
    return Company.create(attributes);
  }

  public async update(
    company: Company,
    attributes: CompanyWritableAttributes
  ): Promise<Company> {
    await company.update(attributes);

    return company;
  }

  public async updateSchedules(
    company: Company,
    schedules: []
  ): Promise<Company> {
    await company.update({ schedules });

    return company;
  }

  public async delete(company: Company): Promise<void> {
    await company.destroy();
  }

  /** Listagem paginada com busca case-insensitive no nome (tela de Empresas). */
  public async findAndCountPaged(
    query: PagedCompaniesQuery
  ): Promise<PagedCompaniesResult> {
    const { searchParam, limit, offset } = query;

    const { count, rows: companies } = await Company.findAndCountAll({
      where: { ...this.buildSearchWhere(searchParam) },
      limit,
      offset,
      order: [["name", "ASC"]]
    });

    return { companies, count };
  }

  /** Todas as empresas, sem includes (varreduras dos jobs de ticket). */
  public async findAll(): Promise<Company[]> {
    return Company.findAll();
  }

  /** Todas as empresas com plano (resumido) e settings (grid de gestão). */
  public async findAllWithPlanAndSettings(): Promise<Company[]> {
    return Company.findAll({
      order: [["name", "ASC"]],
      include: [
        { model: Plan, as: "plan", attributes: ["id", "name", "value"] },
        { model: Setting, as: "settings" }
      ]
    });
  }

  /** Empresas com o plano completo (tela de planos por empresa). */
  public async findAllWithPlans(): Promise<Company[]> {
    return Company.findAll({
      attributes: [
        "id",
        "name",
        "email",
        "status",
        "dueDate",
        "createdAt",
        "phone"
      ],
      order: [["name", "ASC"]],
      include: [{ model: Plan, as: "plan", attributes: PLAN_ATTRIBUTES }]
    });
  }

  /** Uma empresa com o plano completo (rota /companies/listPlan/:id). */
  public async findByIdWithPlan(
    id: string | number
  ): Promise<Company | null> {
    return Company.findOne({
      where: { id },
      attributes: [
        "id",
        "name",
        "email",
        "status",
        "dueDate",
        "createdAt",
        "phone"
      ],
      order: [["name", "ASC"]],
      include: [{ model: Plan, as: "plan", attributes: PLAN_ATTRIBUTES }]
    });
  }

  // ── Onboarding: usuário admin + seeds de settings ─────────────────────────
  // TODO(B?): tocam models de outros domínios; mover para um seeder do módulo
  // settings/users quando o onboarding for revisto (e envolver em transação).

  public async createAdminUser(seed: AdminUserSeed): Promise<User> {
    const { name, email, password, companyId } = seed;

    return User.create({
      name,
      email,
      password,
      profile: "admin",
      companyId
    });
  }

  public async seedDefaultSettings(companyId: number): Promise<void> {
    for (const { key, value } of DEFAULT_SETTING_SEEDS) {
      await Setting.findOrCreate({
        where: { companyId, key },
        defaults: { companyId, key, value }
      });
    }
  }

  /** Cria/atualiza a Setting `campaignsEnabled` (usado por create e update). */
  public async upsertCampaignsEnabledSetting(
    companyId: number,
    campaignsEnabled: boolean
  ): Promise<void> {
    const [setting, created] = await Setting.findOrCreate({
      where: { companyId, key: "campaignsEnabled" },
      defaults: {
        companyId,
        key: "campaignsEnabled",
        value: `${campaignsEnabled}`
      }
    });

    if (!created) {
      await setting.update({ value: `${campaignsEnabled}` });
    }
  }

  /**
   * Expediente atual da empresa (raw SQL preservado do VerifyCurrentSchedule):
   * resolve o horário do dia corrente e se está dentro do expediente.
   */
  public async verifyCurrentSchedule(
    id: string | number
  ): Promise<CurrentSchedule> {
    const sql = `
    select
      s.id,
      s.currentWeekday,
      s.currentSchedule,
        (s.currentSchedule->>'startTime')::time "startTime",
        (s.currentSchedule->>'endTime')::time "endTime",
        (
          now()::time >= (s.currentSchedule->>'startTime')::time and
          now()::time <= (s.currentSchedule->>'endTime')::time
        ) "inActivity"
    from (
      SELECT
            c.id,
            to_char(current_date, 'day') currentWeekday,
            (array_to_json(array_agg(s))->>0)::jsonb currentSchedule
      FROM "Companies" c, jsonb_array_elements(c.schedules) s
      WHERE s->>'weekdayEn' like trim(to_char(current_date, 'day')) and c.id = :id
      GROUP BY 1, 2
    ) s
    where s.currentSchedule->>'startTime' not like '' and s.currentSchedule->>'endTime' not like '';
  `;

    const result: CurrentSchedule = await sequelize.query(sql, {
      replacements: { id },
      type: QueryTypes.SELECT,
      plain: true
    });

    return result;
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

/** Lista completa de atributos de Plan retornada nas telas de plano por empresa. */
const PLAN_ATTRIBUTES = [
  "id",
  "name",
  "users",
  "connections",
  "queues",
  "value",
  "useCampaigns",
  "useSchedules",
  "useInternalChat",
  "useExternalApi",
  "useKanban",
  "useOpenAi",
  "useIntegrations"
];
