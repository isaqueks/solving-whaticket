import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import Company from "../companies/models/Company";
import Queue from "../queues/models/Queue";
import Ticket from "../tickets/models/Ticket";
// Ciclo UsersService ⇄ TicketsService (tickets usa o show deste service nas
// mensagens de transferência): usar o singleton SEMPRE dentro do corpo dos
// métodos (binding CommonJS resolve lazy na chamada).
import { ticketsService } from "../tickets/TicketsService";
import { CreateUserDto } from "./dtos/CreateUserDto";
import {
  ListUsersFilters,
  ListUsersResult
} from "./dtos/ListUsersFilters";
import { SimpleListUsersFilters } from "./dtos/SimpleListUsersFilters";
import { UpdateUserDto } from "./dtos/UpdateUserDto";
import User from "./models/User";
import { SerializedUser, SerializeUser } from "./serializers/SerializeUser";
import { UsersRepository } from "./UsersRepository";

/** Tamanho de página fixo da listagem (comportamento original do ListService). */
const LIST_PAGE_SIZE = 20;

/** Saída de `UsersService.update` — forma original do antigo UpdateUserService. */
export interface UpdateUserResult {
  id: number;
  name: string;
  email: string;
  profile: string;
  companyId: number;
  company: Company | null;
  queues: Queue[];
}

/**
 * Casos de uso do domínio Users (doc 04 §§2–3). Absorve os antigos serviços de
 * `services/UserServices/` (Create/List/Show/Update/Delete/SimpleList) — o
 * AuthUserService fica de fora (pertence ao módulo de auth). Eventos de domínio
 * emitidos via RealtimeGateway (nunca `io.to` direto).
 */
export class UsersService {
  constructor(
    private readonly repository = new UsersRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async list(filters: ListUsersFilters): Promise<ListUsersResult> {
    const { companyId, searchParam = "", pageNumber = "1" } = filters;
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { users, count } = await this.repository.findAndCountPaged({
      companyId,
      searchParam,
      limit,
      offset
    });

    const hasMore = count > offset + users.length;

    return { users, count, hasMore };
  }

  /**
   * Cria um usuário. `notifyCompanyId` é a empresa que recebe o evento realtime
   * (a empresa do ator da requisição — pode ser null no fluxo /signup),
   * separada da empresa do usuário criado, para preservar o comportamento
   * original do controller.
   */
  public async create(
    dto: CreateUserDto,
    notifyCompanyId: number | null
  ): Promise<SerializedUser> {
    const { companyId, email, queueIds = [], profile = "admin" } = dto;

    await this.ensureCompanyUserLimit(companyId);
    await this.ensureEmailAvailable(email);

    const user = await this.repository.create({ ...dto, profile });

    await this.repository.setQueues(user, queueIds);
    await this.repository.reload(user);

    const serializedUser = await SerializeUser(user);

    this.emitUserEvent(notifyCompanyId, {
      action: "create",
      user: serializedUser
    });

    return serializedUser;
  }

  public async show(id: string | number): Promise<User> {
    const user = await this.repository.findDetailedById(id);
    if (!user) {
      throw new AppError("ERR_NO_USER_FOUND", 404);
    }

    return user;
  }

  public async update(
    id: string | number,
    dto: UpdateUserDto,
    companyId: number,
    requestUserId: number
  ): Promise<UpdateUserResult> {
    const user = await this.show(id);

    const requestUser = await this.repository.findById(requestUserId);
    if (requestUser && requestUser.super === false && dto.companyId !== companyId) {
      throw new AppError("O usuário não pertence à esta empresa");
    }

    const { email, password, profile, name, queueIds = [], whatsappId, allTicket } =
      dto;

    await this.repository.update(user, {
      email,
      password,
      profile,
      name,
      whatsappId: whatsappId || null,
      allTicket
    });

    await this.repository.setQueues(user, queueIds);
    await this.repository.reload(user);

    const company = await this.repository.findCompanyById(user.companyId);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      profile: user.profile,
      companyId: user.companyId,
      company,
      queues: user.queues
    };
  }

  public async delete(id: string | number, companyId: number): Promise<void> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new AppError("ERR_NO_USER_FOUND", 404);
    }

    const openTickets = await ticketsService.findOpenByUser(user.id);
    if (openTickets.length > 0) {
      await this.reassignOpenTickets(openTickets, companyId);
    }

    await this.repository.destroy(user);

    this.emitUserEvent(companyId, { action: "delete", userId: id });
  }

  public async simpleList(filters: SimpleListUsersFilters): Promise<User[]> {
    const users = await this.repository.findAllByCompany(filters.companyId);
    if (!users) {
      throw new AppError("ERR_NO_USER_FOUND", 404);
    }

    return users;
  }

  /** Checagem de `super` usada pelo guard de permissão do controller. */
  public async isSuper(id: string | number): Promise<boolean> {
    const user = await this.repository.findById(id);

    return Boolean(user?.super);
  }

  private async ensureCompanyUserLimit(
    companyId?: number | null
  ): Promise<void> {
    if (companyId === undefined) {
      return;
    }

    const company = await this.repository.findCompanyWithPlan(companyId);
    if (company === null) {
      return;
    }

    const usersCount = await this.repository.countByCompany(companyId);
    if (usersCount >= company.plan.users) {
      throw new AppError(
        `Número máximo de usuários já alcançado: ${usersCount}`
      );
    }
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    const emailExists = await this.repository.findByEmail(email);
    if (emailExists) {
      throw new AppError("An user with this email already exists.");
    }
  }

  /**
   * Reatribui os tickets abertos de um usuário deletado (volta para "pending").
   * Absorve o antigo helper `UpdateDeletedUserOpenTicketsStatus`.
   */
  private async reassignOpenTickets(
    tickets: Ticket[],
    companyId: number
  ): Promise<void> {
    for (const ticket of tickets) {
      const ticketId = ticket.id.toString();

      await ticketsService.update({
        ticketData: { status: "pending" },
        ticketId,
        companyId
      });
    }
  }

  private emitUserEvent(companyId: number | null, payload: unknown): void {
    // companyId pode ser null no fluxo /signup (sem ator autenticado) — a
    // emissão para "company-null-*" é preservada do comportamento original
    // (sala sem ouvintes).
    this.realtime.emitToMainChannel(
      companyId as number,
      SocketEvents.companyUser(companyId as number),
      payload
    );
  }
}
