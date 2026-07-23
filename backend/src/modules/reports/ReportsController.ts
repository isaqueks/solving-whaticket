import { Request, Response } from "express";

import { DashboardFilters } from "./dtos/DashboardFilters";
import { ReportsService } from "./ReportsService";

/** Query string dos relatórios por período (`initialDate`/`finalDate`). */
type ReportPeriodQuery = {
  initialDate: string;
  finalDate: string;
};

/**
 * Controller fino (doc 04 §3) do domínio Reports/Dashboard: lê a query,
 * delega ao service e devolve os mesmos payloads/status do antigo
 * `DashboardController`. `companyId` vem sempre de `req.user` (auth da rodada
 * 1), nunca da query string — mesmo que o frontend a envie.
 *
 * Convenção do template (B1): handlers são ARROW PROPERTIES — `this` fica
 * preso à instância e o arquivo de rotas passa o método direto, sem `.bind`.
 */
export class ReportsController {
  constructor(private readonly service = new ReportsService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const filters: DashboardFilters = req.query;
    const { companyId } = req.user;

    const dashboardData = await this.service.getDashboardData(
      companyId,
      filters
    );

    return res.status(200).json(dashboardData);
  };

  public reportsUsers = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { initialDate, finalDate } = req.query as ReportPeriodQuery;
    const { companyId } = req.user;

    const { data } = await this.service.getTicketsAttendance({
      initialDate,
      finalDate,
      companyId
    });

    return res.json({ data });
  };

  public reportsDay = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { initialDate, finalDate } = req.query as ReportPeriodQuery;
    const { companyId } = req.user;

    const { count, data } = await this.service.getTicketsByDay({
      initialDate,
      finalDate,
      companyId
    });

    return res.json({ count, data });
  };
}
