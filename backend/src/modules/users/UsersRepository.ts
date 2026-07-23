import { Sequelize, Op } from "sequelize";

import Company from "../companies/models/Company";
import Plan from "../plans/models/Plan";
import Queue from "../queues/models/Queue";
import Setting from "../settings/models/Setting";
import { CreateUserDto } from "./dtos/CreateUserDto";
import { UpdateUserDto } from "./dtos/UpdateUserDto";
import User from "./models/User";

/** Atributos persistíveis de User (subset gravado por create/update). */
export interface UserWritableAttributes {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  companyId?: number;
  whatsappId?: number | null;
  allTicket?: string;
  /** Flag de presença — gravada pelo logout (módulo auth). */
  online?: boolean;
}

export interface PagedUsersQuery {
  companyId?: number;
  searchParam: string;
  limit: number;
  offset: number;
}

export interface PagedUsersResult {
  users: User[];
  count: number;
}

/**
 * Único ponto de acesso ao model User do domínio (doc 04 §3). Não emite socket
 * nem lança erro de negócio — retorna dados/null e o service decide.
 *
 * Alguns métodos tocam models de OUTROS domínios (Company/Plan, Ticket): ficam
 * marcados com `TODO(...)` para migrar quando o dono do domínio migrar.
 */
export class UsersRepository {
  /** Leitura detalhada (tela de usuário): atributos + filas + empresa. */
  public async findDetailedById(id: string | number): Promise<User | null> {
    return User.findByPk(id, {
      attributes: [
        "name",
        "id",
        "email",
        "companyId",
        "profile",
        "super",
        "tokenVersion",
        "whatsappId",
        "allTicket"
      ],
      include: [
        { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
        { model: Company, as: "company", attributes: ["id", "name"] }
      ]
    });
  }

  /** Instância crua (todos os campos) — usada em checagem de `super` e delete. */
  public async findById(id: string | number): Promise<User | null> {
    return User.findByPk(id);
  }

  public async findByEmail(email: string): Promise<User | null> {
    return User.findOne({ where: { email } });
  }

  /** Usuário por email no escopo da empresa (vínculo attachedToEmail). */
  public async findByCompanyAndEmail(
    companyId: number,
    email: string
  ): Promise<User | null> {
    return User.findOne({
      where: {
        companyId,
        email
      }
    });
  }

  /**
   * Leitura para o login (módulo auth): usuário com filas e empresa (com
   * settings) — includes idênticos aos do antigo AuthUserService.
   */
  public async findByEmailForAuth(email: string): Promise<User | null> {
    return User.findOne({
      where: { email },
      include: ["queues", { model: Company, include: [{ model: Setting }] }]
    });
  }

  public async countByCompany(companyId: number): Promise<number> {
    return User.count({ where: { companyId } });
  }

  public async create(dto: CreateUserDto): Promise<User> {
    const { email, password, name, companyId, profile, whatsappId, allTicket } =
      dto;

    return User.create(
      {
        email,
        password,
        name,
        companyId,
        profile,
        whatsappId: whatsappId || null,
        allTicket
      },
      { include: ["queues", "company"] }
    );
  }

  public async update(
    user: User,
    attributes: UserWritableAttributes
  ): Promise<User> {
    await user.update(attributes);

    return user;
  }

  public async setQueues(user: User, queueIds: number[]): Promise<void> {
    await user.$set("queues", queueIds);
  }

  public async reload(user: User): Promise<void> {
    await user.reload();
  }

  public async destroy(user: User): Promise<void> {
    await user.destroy();
  }

  /** Listagem paginada (busca por nome/email, escopo da empresa). */
  public async findAndCountPaged(
    query: PagedUsersQuery
  ): Promise<PagedUsersResult> {
    const { companyId, searchParam, limit, offset } = query;

    const { count, rows: users } = await User.findAndCountAll({
      where: { ...this.buildSearchWhere(searchParam), companyId },
      attributes: ["name", "id", "email", "companyId", "profile", "createdAt"],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
        { model: Company, as: "company", attributes: ["id", "name"] }
      ]
    });

    return { users, count };
  }

  /** Listagem simples (id/nome/email + filas) para selects do frontend. */
  public async findAllByCompany(companyId: string | number): Promise<User[]> {
    return User.findAll({
      where: { companyId },
      attributes: ["name", "id", "email"],
      include: [{ model: Queue, as: "queues" }],
      order: [["id", "ASC"]]
    });
  }

  // TODO(B?): Company/Plan são de outro domínio — mover quando o dono migrar.
  public async findCompanyWithPlan(
    companyId: number | null
  ): Promise<Company | null> {
    return Company.findOne({
      where: { id: companyId },
      include: [{ model: Plan, as: "plan" }]
    });
  }

  // TODO(B?): Company é de outro domínio — mover quando o dono migrar.
  public async findCompanyById(
    companyId: number | null
  ): Promise<Company | null> {
    return Company.findByPk(companyId);
  }

  /**
   * Filtro de busca por nome/email (busca case-insensitive no nome). Retorna
   * `object` para isolar os operadores do Sequelize (typings v5 quebrados)
   * do contrato tipado de `where`.
   */
  private buildSearchWhere(searchParam: string): object {
    const value = `%${searchParam.toLowerCase()}%`;

    return {
      [Op.or]: [
        {
          "$User.name$": Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("User.name")),
            "LIKE",
            value
          )
        },
        { email: { [Op.like]: value } }
      ]
    };
  }
}
