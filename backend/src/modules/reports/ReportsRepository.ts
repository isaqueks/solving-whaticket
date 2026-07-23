/* eslint-disable camelcase */
import { QueryTypes } from "sequelize";
import * as _ from "lodash";

import database from "../../database";
import {
  DashboardData,
  DashboardFilters
} from "./dtos/DashboardFilters";
import {
  AttendanceByUser,
  ReportPeriodFilters,
  TicketsByDay
} from "./dtos/ReportPeriodFilters";

/**
 * Único ponto do domínio Reports que toca o banco (doc 04 §3). O domínio não
 * tem model próprio: lê `Tickets`/`Users`/`TicketTraking`/... via SQL cru
 * parametrizado. TODOS os textos SQL e os placeholders (`?` posicionais no
 * dashboard, `:nomeados` nos relatórios) são preservados EXATAMENTE como no
 * código antigo (`DashboardDataService`, `TicketsAttendance`, `TicketsDayService`)
 * para não reabrir as SQLi corrigidas na rodada 1.
 */
export class ReportsRepository {
  /**
   * Consulta agregada do dashboard (antigo `DashboardDataService`).
   *
   * O mapeamento filtro→WHERE fica aqui, junto do SQL, porque é construção de
   * query: cada fragmento é SQL cru e a ordem dos `replacements` posicionais
   * (`?`) tem de casar com ele exatamente — separar reabriria a SQLi. Roda com
   * `plain: true`, retornando uma única linha.
   */
  public async getDashboardData(
    companyId: string | number,
    params: DashboardFilters
  ): Promise<DashboardData> {
    const query = `
    with
    traking as (
      select
        c.name "companyName",
        u.name "userName",
        u.online "userOnline",
        w.name "whatsappName",
        ct.name "contactName",
        ct.number "contactNumber",
        (tt."finishedAt" is not null) "finished",
        (tt."userId" is null and tt."finishedAt" is null) "pending",
        coalesce((
          (date_part('day', age(coalesce(tt."ratingAt", tt."finishedAt") , tt."startedAt")) * 24 * 60) +
          (date_part('hour', age(coalesce(tt."ratingAt", tt."finishedAt"), tt."startedAt")) * 60) +
          (date_part('minutes', age(coalesce(tt."ratingAt", tt."finishedAt"), tt."startedAt")))
        ), 0) "supportTime",
        coalesce((
          (date_part('day', age(tt."startedAt", tt."queuedAt")) * 24 * 60) +
          (date_part('hour', age(tt."startedAt", tt."queuedAt")) * 60) +
          (date_part('minutes', age(tt."startedAt", tt."queuedAt")))
        ), 0) "waitTime",
        t.status,
        tt.*,
        ct."id" "contactId"
      from "TicketTraking" tt
      left join "Companies" c on c.id = tt."companyId"
      left join "Users" u on u.id = tt."userId"
      left join "Whatsapps" w on w.id = tt."whatsappId"
      left join "Tickets" t on t.id = tt."ticketId"
      left join "Contacts" ct on ct.id = t."contactId"
      -- filterPeriod
    ),
    counters as (
      select
        (select avg("supportTime") from traking where "supportTime" > 0) "avgSupportTime",
        (
          select
            coalesce(avg(
              (date_part('day', age(t."startedAt", t."queuedAt")) * 24 * 60) +
              (date_part('hour', age(t."startedAt", t."queuedAt")) * 60) +
              (date_part('minutes', age(t."startedAt", t."queuedAt")))
            ), 0)
          from traking t
        ) "avgWaitTime",
        (select count(distinct "id") from "Tickets" where status like 'open' and "companyId" = ?) "supportHappening",
        (select count(distinct "id") from "Tickets" where status like 'pending' and "companyId" = ?) "supportPending",
        (select count(id) from traking where finished) "supportFinished",
        (
          select count(leads.id) from (
            select
              ct1.id,
              count(tt1.id) total
            from traking tt1
            left join "Tickets" t1 on t1.id = tt1."ticketId"
            left join "Contacts" ct1 on ct1.id = t1."contactId"
            group by 1
            having count(tt1.id) = 1
          ) leads
        ) "leads",
        (
          select count(id)
          from "Companies"
        ) "totalCompanies",
        (
          select count(id)
          from "Whatsapps"
          where session <> ''
        ) "totalWhatsappSessions"
    ),
    attedants as (
      select
        u.id,
        u.name,
        coalesce(att."avgSupportTime", 0) "avgSupportTime",
        att.tickets,
        att.rating,
        att.online
      from "Users" u
      left join (
        select
          u1.id,
          u1."name",
          u1."online",
          avg(t."supportTime") "avgSupportTime",
          count(t."id") tickets,
          coalesce(avg(ur.rate), 0) rating
        from "Users" u1
        left join traking t on t."userId" = u1.id
        left join "UserRatings" ur on ur."userId" = t."userId" and ur."createdAt"::date = t."finishedAt"::date
        group by 1, 2
      ) att on att.id = u.id
      where u."companyId" = ?
      order by att.name
    )
    select
      (select coalesce(jsonb_build_object('counters', c.*)->>'counters', '{}')::jsonb from counters c) counters,
      (select coalesce(json_agg(a.*), '[]')::jsonb from attedants a) attendants;
  `;

    let where = 'where tt."companyId" = ?';
    // Weak Sequelize v5 typings + placeholders posicionais: `any[]` confinado
    // ao repository e justificado (doc 04 §4).
    const replacements: any[] = [companyId];

    if (_.has(params, "days")) {
      where += ` and tt."queuedAt" >= (now() - '? days'::interval)`;
      replacements.push(parseInt(`${params.days}`.replace(/\D/g, ""), 10));
    }

    if (_.has(params, "date_from")) {
      where += ` and tt."queuedAt" >= ?`;
      replacements.push(`${params.date_from} 00:00:00`);
    }

    if (_.has(params, "date_to")) {
      where += ` and tt."finishedAt" <= ?`;
      replacements.push(`${params.date_to} 23:59:59`);
    }

    replacements.push(companyId);
    replacements.push(companyId);
    replacements.push(companyId);

    const finalQuery = query.replace("-- filterPeriod", where);

    const responseData: DashboardData = await database.query(finalQuery, {
      replacements,
      type: QueryTypes.SELECT,
      plain: true
    });

    return responseData;
  }

  /** Nomes dos usuários da empresa (antigo `sqlUsers` de `TicketsAttendance`). */
  public async findUserNamesByCompany(
    companyId: number
  ): Promise<{ name: string }[]> {
    const sqlUsers = `select u.name from "Users" u where u."companyId" = :companyId`;

    return database.query<{ name: string }>(sqlUsers, {
      replacements: { companyId },
      type: QueryTypes.SELECT
    });
  }

  /**
   * Atendimentos finalizados agrupados por usuário no período (antigo `sql` de
   * `TicketsAttendance`).
   */
  public async findAttendanceByUser(
    filters: ReportPeriodFilters
  ): Promise<AttendanceByUser[]> {
    const { initialDate, finalDate, companyId } = filters;

    const sql = `
  select
    COUNT(*) AS quantidade,
    u.name AS nome
  from
    "TicketTraking" tt
    left join "Users" u on u.id = tt."userId"
  where
    tt."companyId" = :companyId
    and "ticketId" is not null
    and tt."userId" is not null
    and tt."finishedAt" >= :initialDate
    and tt."finishedAt" <= :finalDate
  group by
    nome
  ORDER BY
    nome asc`;

    return database.query<AttendanceByUser>(sql, {
      replacements: {
        companyId,
        initialDate: `${initialDate} 00:00:00`,
        finalDate: `${finalDate} 23:59:59`
      },
      type: QueryTypes.SELECT
    });
  }

  /**
   * Tickets por período (antigo `TicketsDayService`). O branch decide a forma
   * da query — agrupada por HORA quando início == fim (um único dia), senão
   * por DATA no intervalo. Ambas as variantes e seus `replacements` nomeados
   * são preservados verbatim (SQLi corrigida na rodada 1).
   */
  public async findTicketsByDay(
    filters: ReportPeriodFilters
  ): Promise<TicketsByDay[]> {
    const { initialDate, finalDate, companyId } = filters;

    let sql = '';
    let replacements: { [key: string]: any } = {};

    if (initialDate && initialDate.trim() === finalDate && finalDate.trim()) {
      sql = `
    SELECT
      COUNT(*) AS total,
      extract(hour from tick."createdAt") AS horario
      --to_char(DATE(tick."createdAt"), 'dd-mm-YYYY') as horario
    FROM
      "TicketTraking" tick
    WHERE
      tick."companyId" = :companyId
      and DATE(tick."createdAt") >= :initialDate
      AND DATE(tick."createdAt") <= :finalDate
    GROUP BY
      extract(hour from tick."createdAt")
      --to_char(DATE(tick."createdAt"), 'dd-mm-YYYY')
    ORDER BY
      horario asc;
    `;
      replacements = {
        companyId,
        initialDate: `${initialDate} 00:00:00`,
        finalDate: `${finalDate} 23:59:59`
      };
    } else {
      sql = `
    SELECT
    COUNT(*) AS total,
    to_char(DATE(tick."createdAt"), 'dd/mm/YYYY') as data
  FROM
    "TicketTraking" tick
  WHERE
    tick."companyId" = :companyId
    and DATE(tick."createdAt") >= :initialDate
    AND DATE(tick."createdAt") <= :finalDate
  GROUP BY
    to_char(DATE(tick."createdAt"), 'dd/mm/YYYY')
  ORDER BY
    data asc;
  `;
      replacements = {
        companyId,
        initialDate,
        finalDate
      };
    }

    return database.query<TicketsByDay>(sql, {
      replacements,
      type: QueryTypes.SELECT
    });
  }
}
