import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";

import { TicketsRepository } from "../tickets/TicketsRepository";
import User from "../users/models/User";
import { UsersRepository } from "../users/UsersRepository";

const QUEUE_FALAR_COM_ATENDENTE = 1;

/**
 * Vincula automaticamente ao atendente os tickets da fila "falar com
 * atendente" cujo contato tem e-mail de responsável (antigo
 * `attachAllTicketsToUser`). O agendamento cron vive em jobs/JobScheduler (tick em jobs/TicketSweepProcessor).
 * Lógica preservada — o cache de usuários por e-mail continua POR EXECUÇÃO
 * (um Map novo a cada varredura, como no original).
 */
export class TicketUserAttacher {
  constructor(
    private readonly ticketsRepository = new TicketsRepository(),
    private readonly usersRepository = new UsersRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async attachAllTicketsToUser(companyId: number): Promise<void> {
    const nonAttached = await this.ticketsRepository.findUnattachedByCompanyAndQueue(
      companyId,
      QUEUE_FALAR_COM_ATENDENTE
    );

    const userCache = new Map<string, User>();

    for (const ticket of nonAttached) {
      if (ticket.contact.attachedToEmail) {
        const user = await this.getCachedUserByEmail(
          userCache,
          ticket.contact.attachedToEmail,
          companyId
        );

        if (user) {
          await this.ticketsRepository.updateInstance(ticket, {
            userId: user.id
          });

          this.realtime.emitTicketToLegacyOpenRoom(companyId, {
            action: "update",
            ticket
          });
        }
      }
    }
  }

  private async getCachedUserByEmail(
    userCache: Map<string, User>,
    email: string,
    companyId: number
  ): Promise<User | null> {
    if (userCache.has(email)) {
      return userCache.get(email) || null;
    }

    const user = await this.usersRepository.findByCompanyAndEmail(
      companyId,
      email
    );

    userCache.set(email, user);
    return user;
  }
}

export const ticketUserAttacher = new TicketUserAttacher();
