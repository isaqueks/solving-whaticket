import sequelize from "../../database/index";
import { QueryTypes } from "sequelize";

interface Return {
  data: {};
  count: number;
}

interface Request {
  initialDate: string;
  finalDate: string;
  companyId: number;
}

interface DataReturn {
  total: number;
  data?: number;
  horario?: string;
}

export const TicketsDayService = async ({ initialDate, finalDate, companyId }: Request): Promise<Return> => {

  let sql = '';
  let count = 0;
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
    `
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
  `
    replacements = {
      companyId,
      initialDate,
      finalDate
    };
  }

  const data: DataReturn[] = await sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT
  });

  data.forEach((register) => {
    count += Number(register.total);
  })

  return { data, count };

}
