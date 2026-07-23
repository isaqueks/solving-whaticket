import { Op, fn, where, col, Filterable, Includeable } from "sequelize";
import { startOfDay, endOfDay, parseISO, subHours } from "date-fns";
import { intersection } from "lodash";

import Ticket from "./models/Ticket";
import TicketTraking from "./models/TicketTraking";
import UserRating from "./models/UserRating";
// Models de outros domínios usados APENAS em includes/joins nomeados deste
// repository (doc 04 §3, exceção pragmática) — nunca vazam para o service.
import Contact from "../contacts/models/Contact";
import Queue from "../queues/models/Queue";
import User from "../users/models/User";
import Tag from "../tags/models/Tag";
import TicketTag from "../tags/models/TicketTag";
import Whatsapp from "../whatsapp/models/Whatsapp";
import GroupParticipant from "../group-participants/models/GroupParticipant";

/** Atributos persistíveis de Ticket (subset gravado pelos casos de uso). */
export interface TicketWritableAttributes {
  status?: string;
  userId?: number | null;
  queueId?: number | null;
  whatsappId?: number | string;
  companyId?: number;
  contactId?: number;
  isGroup?: boolean;
  unreadMessages?: number;
  lastMessage?: string;
  chatbot?: boolean | null;
  queueOptionId?: number | null;
  useIntegration?: boolean;
  integrationId?: number | null;
  promptId?: number | null;
  typebotStatus?: boolean;
  typebotSessionId?: string | null;
  isBot?: boolean;
  fromMe?: boolean;
  amountUsedBotQueues?: number;
  updatedAt?: Date;
  /**
   * Instância passada no create do fluxo wbot (comportamento original do
   * FindOrCreateTicketService — o Sequelize ignora a chave de associação).
   */
  whatsapp?: Whatsapp;
}

/** Atributos persistíveis de TicketTraking. */
export interface TicketTrakingWritableAttributes {
  ticketId?: number | string;
  companyId?: number | string;
  whatsappId?: number | string | null;
  userId?: number | string | null;
  queueId?: number | null;
  rated?: boolean;
  startedAt?: Date | null;
  queuedAt?: Date | null;
  finishedAt?: Date | null;
  closedAt?: Date | null;
  ratingAt?: Date | null;
  chatbotAt?: Date | null;
}

/**
 * Filtros da listagem, já resolvidos pelo service (`userQueueIds` vem
 * pré-carregado quando `withUnreadMessages === "true"`).
 */
export interface TicketsListQuery {
  searchParam: string;
  pageNumber: string;
  status?: string;
  date?: string;
  updatedAt?: string;
  showAll?: string;
  userId: string;
  withUnreadMessages?: string;
  queueIds: number[];
  tags: number[];
  users: number[];
  companyId: number;
  unread?: "unread" | "read";
  /** Filas do usuário — usadas apenas no ramo withUnreadMessages. */
  userQueueIds?: number[];
}

export interface PagedTicketsResult {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

/**
 * As DUAS variantes da listagem de tickets (diff linha a linha das cópias
 * antigas ListTicketsService × ListTicketsServiceKanban). Divergências reais,
 * todas explícitas em `buildListQuery`:
 *
 * 1. contact include: default carrega `profilePicUrl`; kanban não.
 * 2. status: default aplica o filtro `status` só se informado; kanban IGNORA o
 *    parâmetro e força sempre `status IN (pending, open)`.
 * 3. date/updatedAt: default MESCLA o intervalo ao where acumulado; kanban
 *    SUBSTITUI o where inteiro (descarta filtros anteriores, inclusive o
 *    status forçado — comportamento original preservado).
 * 4. filtro `unread`: só existe no default.
 * 5. filtro `users`: default restringe a pré-consulta por companyId; kanban
 *    não (o resultado final é idêntico porque o where final sempre recebe
 *    companyId — divergência preservada mesmo assim).
 * 6. página: default = 100; kanban = 40.
 *
 * Idênticos nas duas variantes: where inicial (userId OU pending + queueIds),
 * showAll, searchParam (nome/número do contato), withUnreadMessages, filtro
 * `tags` (interseção por TicketTag), companyId final, order/distinct/subQuery
 * e o cálculo de hasMore no service. As projeções das pré-consultas de
 * tags/users (`attributes: ["ticketId"]`/`["id"]`, presentes só na versão
 * default) foram unificadas — mesmo resultado, menos colunas trafegadas.
 */
type TicketsListVariant = "default" | "kanban";

const LIST_PAGE_SIZE = 100;
const KANBAN_PAGE_SIZE = 40;

/**
 * Único ponto de acesso aos models do domínio (doc 04 §3): Ticket,
 * TicketTraking e UserRating (gravado pelo fluxo de avaliação do wbot via
 * `createUserRating`). Não emite socket nem lança erro de negócio — retorna
 * dados/null e o service decide.
 */
export class TicketsRepository {
  public async findById(id: string | number): Promise<Ticket | null> {
    return Ticket.findByPk(id);
  }

  public async findByIdWithContactAndQueue(
    id: number
  ): Promise<Ticket | null> {
    return Ticket.findByPk(id, { include: ["contact", "queue"] });
  }

  /** Leitura detalhada (tela do ticket) — includes do antigo ShowTicketService. */
  public async findByIdWithDetails(id: string | number): Promise<Ticket | null> {
    return Ticket.findByPk(id, {
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "number", "email", "profilePicUrl", "attachedToEmail", "isGroup"],
          include: [
            "extraInfo",
            {
              model: GroupParticipant,
              as: "groupParticipants",
              include: [
                {
                  model: Contact,
                  as: "participantContact",
                  attributes: ["id", "name", "number", "email", "profilePicUrl"]
                }
              ]
            }
          ]
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name"]
        },
        {
          model: Queue,
          as: "queue",
          attributes: ["id", "name", "color"],
          include: ["queueIntegrations"]
        },
        {
          model: Whatsapp,
          as: "whatsapp",
          attributes: ["name"]
        },
        {
          model: Tag,
          as: "tags",
          attributes: ["id", "name", "color"]
        }
      ]
    });
  }

  /** Leitura detalhada por uuid — includes do antigo ShowTicketFromUUIDService. */
  public async findByUuidWithDetails(uuid: string): Promise<Ticket | null> {
    return Ticket.findOne({
      where: {
        uuid
      },
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "number", "email", "profilePicUrl", "isGroup"],
          include: [
            "extraInfo",
            {
              model: GroupParticipant,
              as: "groupParticipants",
              include: [
                {
                  model: Contact,
                  as: "participantContact",
                  attributes: ["id", "name", "number", "email", "profilePicUrl"]
                }
              ]
            }
          ]
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name"]
        },
        {
          model: Queue,
          as: "queue",
          attributes: ["id", "name", "color"]
        },
        {
          model: Whatsapp,
          as: "whatsapp",
          attributes: ["name"]
        },
        {
          model: Tag,
          as: "tags",
          attributes: ["id", "name", "color"]
        }
      ]
    });
  }

  /** Primeiro ticket do contato na empresa (fluxo ticket-by-number). */
  public async findFirstByContactAndCompany(
    contactId: number,
    companyId: number
  ): Promise<Ticket | null> {
    return Ticket.findOne({
      where: {
        contactId,
        companyId
      }
    });
  }

  /**
   * Ticket aberto/pendente do contato (antigo helper CheckContactOpenTickets):
   * com whatsappId restringe à conexão; sem, procura em qualquer conexão.
   */
  public async findOpenOrPendingByContact(
    contactId: number,
    whatsappId?: string
  ): Promise<Ticket | null> {
    if (!whatsappId) {
      return Ticket.findOne({
        where: {
          contactId,
          status: { [Op.or]: ["open", "pending"] }
        }
      });
    }

    return Ticket.findOne({
      where: {
        contactId,
        status: { [Op.or]: ["open", "pending"] },
        whatsappId
      }
    });
  }

  /** Último ticket (qualquer status ativo/fechado) do contato na conexão. */
  public async findLatestByContactAndWhatsapp(
    contactId: number,
    companyId: number,
    whatsappId: number
  ): Promise<Ticket | null> {
    return Ticket.findOne({
      where: {
        status: {
          [Op.or]: ["open", "pending", "closed"]
        },
        contactId,
        companyId,
        whatsappId
      },
      order: [["id", "DESC"]]
    });
  }

  /** Último ticket do contato de grupo (fallback do fluxo wbot). */
  public async findLatestByContact(contactId: number): Promise<Ticket | null> {
    return Ticket.findOne({
      where: {
        contactId
      },
      order: [["updatedAt", "DESC"]]
    });
  }

  /** Ticket do contato atualizado nas últimas 2 horas (fluxo wbot 1:1). */
  public async findRecentByContact(contactId: number): Promise<Ticket | null> {
    return Ticket.findOne({
      where: {
        updatedAt: {
          [Op.between]: [+subHours(new Date(), 2), +new Date()]
        },
        contactId
      },
      order: [["updatedAt", "DESC"]]
    });
  }

  /** Tickets abertos de um usuário (reatribuição no delete de usuário). */
  public async findOpenByUserId(userId: number): Promise<Ticket[]> {
    return Ticket.findAll({ where: { status: "open", userId } });
  }

  /** Todos os tickets — varredura administrativa (fixTickets). */
  public async findAllForMaintenance(): Promise<Ticket[]> {
    return Ticket.findAll();
  }

  /** Tickets pelos ids informados (fluxo campanha-por-tag, B6). */
  public async findAllByIds(ids: number[]): Promise<Ticket[]> {
    return Ticket.findAll({ where: { id: ids } });
  }

  /** Ticket com as tags carregadas (sincronização de tags do kanban). */
  public async findWithTags(ticketId: number): Promise<Ticket | null> {
    return Ticket.findByPk(ticketId, { include: [Tag] });
  }

  /** findOrCreate do fluxo de criação manual (antigo CreateTicketService). */
  public async findOrCreate(
    lookup: { contactId: number; companyId: number; whatsappId: number },
    defaults: TicketWritableAttributes
  ): Promise<Ticket> {
    const [ticket] = await Ticket.findOrCreate({
      where: { ...lookup },
      defaults: { ...lookup, ...defaults }
    });

    return ticket;
  }

  public async create(attributes: TicketWritableAttributes): Promise<Ticket> {
    // Typings do Sequelize v5 não modelam atributos de criação — cast
    // confinado ao repository (doc 04 §4).
    return Ticket.create(attributes as Partial<Ticket>);
  }

  public async updateById(
    id: number,
    attributes: TicketWritableAttributes
  ): Promise<void> {
    await Ticket.update(attributes, { where: { id } });
  }

  public async updateInstance(
    ticket: Ticket,
    attributes: TicketWritableAttributes
  ): Promise<Ticket> {
    return ticket.update(attributes);
  }

  public async reload(ticket: Ticket): Promise<void> {
    await ticket.reload();
  }

  public async reloadWithContactAndTags(ticket: Ticket): Promise<void> {
    await ticket.reload({
      include: ["contact", "tags"]
    });
  }

  public async setWhatsapp(ticket: Ticket, whatsapp: Whatsapp): Promise<void> {
    await ticket.$set("whatsapp", whatsapp);
  }

  public async destroy(ticket: Ticket): Promise<void> {
    await ticket.destroy();
  }

  // ── Consultas do fluxo wbot (módulo whatsapp-session, B5) ──────────────────

  /** Tickets pendentes sem fila (job de transferência automática). */
  public async findPendingWithoutQueue(): Promise<Ticket[]> {
    return Ticket.findAll({
      where: {
        status: "pending",
        queueId: {
          [Op.is]: null
        }
      }
    });
  }

  /** Ticket do contato na conexão/empresa (monitor de chamadas do wbot). */
  public async findOneByContactAndWhatsapp(
    contactId: number,
    whatsappId: number | undefined,
    companyId: number
  ): Promise<Ticket | null> {
    return Ticket.findOne({
      where: {
        contactId,
        whatsappId,
        companyId
      }
    });
  }

  /** Tickets abertos da empresa (varredura de fechamento automático). */
  public async findAndCountOpenByCompany(
    companyId: number
  ): Promise<{ rows: Ticket[]; count: number }> {
    const { rows, count } = await Ticket.findAndCountAll({
      where: { status: { [Op.in]: ["open"] }, companyId },
      order: [["updatedAt", "DESC"]]
    });

    return { rows, count };
  }

  /**
   * Tickets sem atendente na fila indicada cujo contato tem e-mail vinculado
   * (job de vínculo automático attach-to-user).
   */
  public async findUnattachedByCompanyAndQueue(
    companyId: number,
    queueId: number
  ): Promise<Ticket[]> {
    return Ticket.findAll({
      where: {
        userId: {
          [Op.is]: null
        },
        companyId,
        queueId
      },
      include: [
        {
          association: "contact",
          required: true, // INNER JOIN (coloca false se quiser LEFT)
          where: {
            attachedToEmail: { [Op.not]: null }
          }
        }
      ]
    });
  }

  /** Recarrega a instância com fila, atendente e contato (reabertura wbot). */
  public async reloadWithQueueUserContact(ticket: Ticket): Promise<void> {
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });
  }

  /** Registra a avaliação do atendimento (fluxo de rating do wbot). */
  public async createUserRating(attributes: {
    ticketId: number | string;
    companyId: number | string;
    userId: number | string | null;
    rate: number;
  }): Promise<UserRating> {
    // Typings do Sequelize v5 não modelam atributos de criação — cast
    // confinado ao repository (doc 04 §4).
    return UserRating.create(attributes as Partial<UserRating>);
  }

  // ── TicketTraking ──────────────────────────────────────────────────────────

  /** Traking em aberto (finishedAt IS NULL) do ticket. */
  public async findOpenTraking(
    ticketId: string | number
  ): Promise<TicketTraking | null> {
    return TicketTraking.findOne({
      where: {
        ticketId,
        finishedAt: {
          [Op.is]: null
        }
      }
    });
  }

  /** Traking mais recente do ticket (job de transferência automática). */
  public async findLatestTrakingByTicket(
    ticketId: number
  ): Promise<TicketTraking | null> {
    return TicketTraking.findOne({
      where: {
        ticketId
      },
      order: [["createdAt", "DESC"]]
    });
  }

  public async createTraking(
    attributes: TicketTrakingWritableAttributes
  ): Promise<TicketTraking> {
    // Typings do Sequelize v5 não modelam atributos de criação — cast
    // confinado ao repository (doc 04 §4).
    return TicketTraking.create(attributes as Partial<TicketTraking>);
  }

  /**
   * Atualiza a instância de traking. Retorna a promise SEM consumir — dois
   * pontos do fluxo de update original disparam sem await (comportamento
   * preservado; o `save()` posterior persiste o estado).
   */
  public async updateTrakingInstance(
    traking: TicketTraking,
    attributes: TicketTrakingWritableAttributes
  ): Promise<TicketTraking> {
    return traking.update(attributes);
  }

  public async saveTraking(traking: TicketTraking): Promise<void> {
    await traking.save();
  }

  // ── Listagens (query builder unificado — ver nota em TicketsListVariant) ───

  public async findAndCountForList(
    query: TicketsListQuery
  ): Promise<PagedTicketsResult> {
    return this.findAndCountByVariant(query, "default", LIST_PAGE_SIZE);
  }

  public async findAndCountForKanban(
    query: TicketsListQuery
  ): Promise<PagedTicketsResult> {
    return this.findAndCountByVariant(query, "kanban", KANBAN_PAGE_SIZE);
  }

  private async findAndCountByVariant(
    query: TicketsListQuery,
    variant: TicketsListVariant,
    limit: number
  ): Promise<PagedTicketsResult> {
    const whereCondition = await this.buildListWhere(query, variant);
    const includeCondition = this.buildListInclude(variant);

    const offset = limit * (+query.pageNumber - 1);

    const { count, rows: tickets } = await Ticket.findAndCountAll({
      where: whereCondition,
      include: includeCondition,
      distinct: true,
      limit,
      offset,
      order: [["updatedAt", "DESC"]],
      subQuery: false
    });

    const hasMore = count > offset + tickets.length;

    return { tickets, count, hasMore };
  }

  private buildListInclude(variant: TicketsListVariant): Includeable[] {
    // Divergência 1: só a listagem principal carrega o profilePicUrl.
    const contactAttributes =
      variant === "default"
        ? ["id", "name", "number", "email", "profilePicUrl"]
        : ["id", "name", "number", "email"];

    return [
      {
        model: Contact,
        as: "contact",
        attributes: contactAttributes
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      },
      {
        model: Tag,
        as: "tags",
        attributes: ["id", "name", "color"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["name"]
      }
    ];
  }

  /**
   * Monta o where na MESMA sequência dos serviços originais — a ordem importa:
   * passos posteriores sobrescrevem chaves (inclusive o `Op.or` inicial) e, no
   * kanban, date/updatedAt substituem o acumulado inteiro.
   */
  private async buildListWhere(
    query: TicketsListQuery,
    variant: TicketsListVariant
  ): Promise<Filterable["where"]> {
    const {
      searchParam,
      status,
      date,
      updatedAt,
      showAll,
      userId,
      withUnreadMessages,
      queueIds,
      tags,
      users,
      companyId,
      unread,
      userQueueIds = []
    } = query;

    let whereCondition: Filterable["where"] = {
      [Op.or]: [{ userId }, { status: "pending" }],
      queueId: { [Op.or]: [queueIds, null] }
    };

    if (showAll === "true") {
      whereCondition = { queueId: { [Op.or]: [queueIds, null] } };
    }

    // Divergência 2: kanban ignora o parâmetro `status` e força pending/open.
    if (variant === "kanban") {
      whereCondition = {
        ...whereCondition,
        status: { [Op.or]: ["pending", "open"] }
      };
    } else if (status) {
      whereCondition = {
        ...whereCondition,
        status
      };
    }

    if (searchParam) {
      const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

      // Busca por corpo de mensagem intencionalmente desligada: o join com a
      // tabela de mensagens (a maior) com LIKE de curinga à esquerda força um
      // full scan a cada tecla. Nome/número do contato bastam.
      whereCondition = {
        ...whereCondition,
        [Op.or]: [
          {
            "$contact.name$": where(
              fn("LOWER", col("contact.name")),
              "LIKE",
              `%${sanitizedSearchParam}%`
            )
          },
          { "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` } }
        ]
      };
    }

    // Divergência 3: no kanban, date/updatedAt SUBSTITUEM o where acumulado.
    if (date) {
      const createdAtRange = {
        createdAt: {
          [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
        }
      };

      whereCondition =
        variant === "kanban"
          ? createdAtRange
          : { ...whereCondition, ...createdAtRange };
    }

    if (updatedAt) {
      const updatedAtRange = {
        updatedAt: {
          [Op.between]: [
            +startOfDay(parseISO(updatedAt)),
            +endOfDay(parseISO(updatedAt))
          ]
        }
      };

      whereCondition =
        variant === "kanban"
          ? updatedAtRange
          : { ...whereCondition, ...updatedAtRange };
    }

    if (withUnreadMessages === "true") {
      whereCondition = {
        [Op.or]: [{ userId }, { status: "pending" }],
        queueId: { [Op.or]: [userQueueIds, null] },
        unreadMessages: { [Op.gt]: 0 }
      };
    }

    // Divergência 4: filtro read/unread existe só na listagem principal.
    if (variant === "default" && unread) {
      whereCondition = {
        ...whereCondition,
        unreadMessages: unread === "unread" ? { [Op.gt]: 0 } : 0
      };
    }

    if (Array.isArray(tags) && tags.length > 0) {
      const ticketsTagFilter: number[][] = [];
      for (const tag of tags) {
        const ticketTags = await TicketTag.findAll({
          where: { tagId: tag },
          attributes: ["ticketId"]
        });
        if (ticketTags) {
          ticketsTagFilter.push(ticketTags.map(t => t.ticketId));
        }
      }

      const ticketsIntersection: number[] = intersection(...ticketsTagFilter);

      whereCondition = {
        ...whereCondition,
        id: {
          [Op.in]: ticketsIntersection
        }
      };
    }

    if (Array.isArray(users) && users.length > 0) {
      const ticketsUserFilter: number[][] = [];
      for (const user of users) {
        // Divergência 5: o kanban não restringia a pré-consulta por empresa
        // (resultado final idêntico — o companyId entra no where final).
        const ticketUsers = await Ticket.findAll({
          where:
            variant === "kanban"
              ? { userId: user }
              : { userId: user, companyId },
          attributes: ["id"]
        });
        if (ticketUsers) {
          ticketsUserFilter.push(ticketUsers.map(t => t.id));
        }
      }

      const ticketsIntersection: number[] = intersection(...ticketsUserFilter);

      whereCondition = {
        ...whereCondition,
        id: {
          [Op.in]: ticketsIntersection
        }
      };
    }

    return {
      ...whereCondition,
      companyId
    };
  }
}
