import { DashboardData, DashboardFilters } from "./dtos/DashboardFilters";
import {
  ReportPeriodFilters,
  TicketsAttendanceResult,
  TicketsByDayResult
} from "./dtos/ReportPeriodFilters";
import { ReportsRepository } from "./ReportsRepository";

/**
 * Casos de uso do domínio Reports/Dashboard (doc 04 §§2–3). Absorve os antigos
 * `ReportService/DashboardDataService`, `TicketsAttendance` e `TicketsDayService`.
 * Todo o SQL cru vive no repository; aqui ficam a orquestração e a lógica de
 * negócio (merge de usuários sem atendimento, soma da contagem).
 */
export class ReportsService {
  constructor(
    private readonly repository = new ReportsRepository()
  ) {}

  /** Consulta agregada do dashboard (contadores + atendentes). */
  public async getDashboardData(
    companyId: number,
    filters: DashboardFilters
  ): Promise<DashboardData> {
    return this.repository.getDashboardData(companyId, filters);
  }

  /**
   * Atendimentos finalizados por usuário no período. Completa a lista com os
   * usuários que não tiveram atendimento (quantidade 0), como no original.
   */
  public async getTicketsAttendance(
    filters: ReportPeriodFilters
  ): Promise<TicketsAttendanceResult> {
    const users = await this.repository.findUserNamesByCompany(
      filters.companyId
    );
    const data = await this.repository.findAttendanceByUser(filters);

    users.forEach(user => {
      const indexCreated = data.findIndex(item => item.nome === user.name);

      if (indexCreated === -1) {
        data.push({ quantidade: 0, nome: user.name });
      }
    });

    return { data };
  }

  /** Tickets por dia/hora no período, com a contagem total somada. */
  public async getTicketsByDay(
    filters: ReportPeriodFilters
  ): Promise<TicketsByDayResult> {
    const data = await this.repository.findTicketsByDay(filters);

    let count = 0;
    data.forEach(register => {
      count += Number(register.total);
    });

    return { data, count };
  }
}
