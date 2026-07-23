import * as Sentry from "@sentry/node";
import { QueryTypes } from "sequelize";

import sequelize from "../database";
import { CompaniesRepository } from "../modules/companies/CompaniesRepository";
// Models importados APENAS pelos `tableName` usados no SQL cru da varredura
// de criação automática (nenhuma query via model aqui) — exceção justificada
// prevista na fase B6 (o acesso a Ticket é via ticketsService).
import Contact from "../modules/contacts/models/Contact";
import Ticket from "../modules/tickets/models/Ticket";
import User from "../modules/users/models/User";
// Ciclo tickets ⇄ whatsapp-session: usar os singletons SEMPRE dentro do corpo
// dos métodos (binding CommonJS resolve lazy na chamada).
import { ticketsService } from "../modules/tickets/TicketsService";
import { ticketAutoCloser } from "../modules/whatsapp-session/TicketAutoCloser";
import { ticketUserAttacher } from "../modules/whatsapp-session/TicketUserAttacher";
import { UsersRepository } from "../modules/users/UsersRepository";
import { logger } from "../utils/logger";

/** Linha da varredura de contatos sem ticket (SQL cru abaixo). */
interface UnticketedContactRow {
  id: number;
  companyId: number;
  attachedToEmail: string;
}

/**
 * Corpos das varreduras cron de tickets (antigo queues/ticketJobs.ts):
 * vínculo automático a usuário, fechamento automático e criação automática.
 * O AGENDAMENTO (CronJob + guard de instância principal) vive no
 * JobScheduler — este processor só executa cada tick.
 */
export class TicketSweepProcessor {
  /**
   * Cache email→usuário da varredura de criação automática (era estado de
   * módulo; vida de processo idêntica como estado da instância do singleton).
   */
  private readonly userByEmailCache = new Map<string, User>();

  constructor(
    private readonly companiesRepository = new CompaniesRepository(),
    private readonly usersRepository = new UsersRepository()
  ) {}

  /** Tick (a cada 10 min): vincula tickets sem atendente ao usuário do contato. */
  public async attachTicketsToUsers(): Promise<void> {
    const companies = await this.companiesRepository.findAll();
    for (const c of companies) {
      try {
        const companyId = c.id;
        await ticketUserAttacher.attachAllTicketsToUser(companyId);
      } catch (e) {
        Sentry.captureException(e);
        logger.error(
          "attachAllTicketsToUser -> Verify: error",
          (e as Error).message
        );
      }
    }
  }

  /** Tick (a cada 3 min): fecha tickets abertos além do limite de inatividade. */
  public async closeTicketsAutomatic(): Promise<void> {
    const companies = await this.companiesRepository.findAll();
    for (const c of companies) {
      try {
        const companyId = c.id;
        await ticketAutoCloser.closeAllOpenTickets(companyId);
      } catch (e) {
        Sentry.captureException(e);
        logger.error(
          "ClosedAllOpenTickets -> Verify: error",
          (e as Error).message
        );
      }
    }
  }

  /** Tick (a cada 10 min): cria ticket fechado para contatos vinculados sem ticket. */
  public async createTicketsAutomatic(): Promise<void> {
    const contacts = (await sequelize.query(/*sql*/ `
    SELECT
      c.id as id,
      c."companyId" as "companyId",
      c."attachedToEmail" as "attachedToEmail"
    FROM
      "${Contact.tableName}" c
    WHERE
      c.id NOT IN (
        SELECT DISTINCT t."contactId" FROM "${Ticket.tableName}" t
      ) AND
      c."attachedToEmail" IS NOT NULL
  `, {
      type: QueryTypes.SELECT
    })) as UnticketedContactRow[];

    for (const c of contacts) {
      const user = await this.getUserByEmail(c.attachedToEmail);
      if (!user) {
        continue;
      }

      await ticketsService.create({
        contactId: c.id,
        status: "closed",
        companyId: c.companyId,
        userId: user.id
      });
    }
  }

  private async getUserByEmail(email: string): Promise<User | null> {
    if (this.userByEmailCache.has(email)) {
      return this.userByEmailCache.get(email);
    }

    const user = await this.usersRepository.findByEmail(email);
    if (user) {
      this.userByEmailCache.set(email, user);
    }

    return user;
  }
}

export const ticketSweepProcessor = new TicketSweepProcessor();
