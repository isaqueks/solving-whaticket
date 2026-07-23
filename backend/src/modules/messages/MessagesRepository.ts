import { Op } from "sequelize";

import Message from "./models/Message";
// Models de outros domínios usados APENAS em includes nomeados deste
// repository (doc 04 §3, exceção pragmática).
import Ticket from "../tickets/models/Ticket";
import Queue from "../queues/models/Queue";
import Whatsapp from "../whatsapp/models/Whatsapp";

/** Atributos persistíveis de Message (subset gravado pelos casos de uso). */
export interface MessageWritableAttributes {
  id?: string;
  ticketId?: number;
  body?: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  ack?: number;
  queueId?: number;
  quotedMsgId?: string;
  remoteJid?: string;
  participant?: string;
  dataJson?: string;
  isDeleted?: boolean;
  isEdited?: boolean;
  companyId?: number;
}

export interface PagedMessagesQuery {
  ticketId: string;
  companyId: number;
  queues: number[];
  limit: number;
  offset: number;
}

export interface PagedMessagesResult {
  messages: Message[];
  count: number;
}

/**
 * Único ponto de acesso ao model do domínio (doc 04 §3): Message. Não emite
 * socket nem lança erro de negócio — retorna dados/null e o service decide.
 */
export class MessagesRepository {
  /** Insere/atualiza pela PK (id do WhatsApp) — caminho quente do wbot. */
  public async upsert(attributes: MessageWritableAttributes): Promise<void> {
    // Typings do Sequelize v5 não modelam atributos de upsert — cast
    // confinado ao repository (doc 04 §4).
    await Message.upsert(attributes as Partial<Message>);
  }

  public async findById(id: string): Promise<Message | null> {
    return Message.findOne({
      where: { id }
    });
  }

  /** Mensagem com contato, ticket (contato/fila/conexão) e citada — pós-upsert. */
  public async findByIdWithRelations(id: string): Promise<Message | null> {
    return Message.findByPk(id, {
      include: [
        "contact",
        {
          model: Ticket,
          as: "ticket",
          include: [
            "contact",
            "queue",
            {
              model: Whatsapp,
              as: "whatsapp",
              attributes: ["name"]
            }
          ]
        },
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });
  }

  public async updateInstance(
    message: Message,
    attributes: MessageWritableAttributes
  ): Promise<Message> {
    return message.update(attributes);
  }

  /** Página de mensagens do ticket (ordem DESC — o service reverte). */
  public async findAndCountByTicket(
    query: PagedMessagesQuery
  ): Promise<PagedMessagesResult> {
    const { ticketId, companyId, queues, limit, offset } = query;

    // `queueId` opcional montado fora do literal — WhereOptions do Sequelize
    // v5 não indexa por string (mesma query do serviço original).
    const where: { ticketId: string; companyId: number; queueId?: unknown } = {
      ticketId,
      companyId
    };

    if (queues.length > 0) {
      where.queueId = {
        [Op.or]: {
          [Op.in]: queues,
          [Op.eq]: null
        }
      };
    }

    const { count, rows: messages } = await Message.findAndCountAll({
      where,
      limit,
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        },
        {
          model: Queue,
          as: "queue"
        }
      ],
      offset,
      order: [["createdAt", "DESC"]]
    });

    return { messages, count };
  }

  /** Mensagens recebidas ainda não lidas do ticket (mais recentes primeiro). */
  public async findUnreadIncomingByTicket(ticketId: number): Promise<Message[]> {
    return Message.findAll({
      where: {
        ticketId,
        fromMe: false,
        read: false
      },
      order: [["createdAt", "DESC"]]
    });
  }

  /** Marca como lidas todas as mensagens pendentes do ticket. */
  public async markAllAsReadByTicket(ticketId: number): Promise<void> {
    await Message.update(
      { read: true },
      {
        where: {
          ticketId,
          read: false
        }
      }
    );
  }

  /** Última mensagem do ticket (varredura administrativa fixTickets). */
  public async findLastByTicket(ticketId: number): Promise<Message | null> {
    return Message.findOne({
      where: { ticketId },
      order: [["createdAt", "DESC"]]
    });
  }

  // ── Consultas do fluxo wbot (módulo whatsapp-session, B5) ──────────────────

  /**
   * Busca pela PK aceitando id ausente — `findByPk(null/undefined)` devolve
   * null sem consultar (semântica usada pelo ack handler do wbot).
   */
  public async findByPrimaryKey(
    id: string | null | undefined
  ): Promise<Message | null> {
    return Message.findByPk(id ?? undefined);
  }

  /** Mensagem por id no escopo da empresa (hooks de campanha do wbot). */
  public async findByIdAndCompany(
    id: string,
    companyId: number
  ): Promise<Message | null> {
    return Message.findOne({
      where: { id, companyId }
    });
  }

  /** Existência da mensagem no escopo da empresa (dedup do lote do wbot). */
  public async countByIdAndCompany(
    id: string,
    companyId: number
  ): Promise<number> {
    return Message.count({
      where: { id, companyId }
    });
  }

  /** Última mensagem do contato na empresa (guarda de mensagem de conclusão). */
  public async findLastByContactAndCompany(
    contactId: number,
    companyId: number
  ): Promise<Message | null> {
    return Message.findOne({
      where: {
        contactId,
        companyId
      },
      order: [["createdAt", "DESC"]]
    });
  }

  /** Última mensagem enviada por nós no ticket (guarda de saudação do wbot). */
  public async findLastFromMeByTicket(
    ticketId: number
  ): Promise<Message | null> {
    return Message.findOne({
      where: {
        ticketId,
        fromMe: true
      },
      order: [["createdAt", "DESC"]]
    });
  }

  /** Última mensagem enviada por nós para o jid (menu de filas do chatbot). */
  public async findLastFromMeByRemoteJid(
    remoteJid: string
  ): Promise<Message | null> {
    return Message.findOne({
      where: {
        remoteJid,
        fromMe: true
      },
      order: [["createdAt", "DESC"]],
      limit: 1
    });
  }

  /** Mensagens por ids, em ordem cronológica (encaminhamento). */
  public async findAllByIdsOrdered(ids: string[]): Promise<Message[]> {
    return Message.findAll({
      where: {
        id: {
          [Op.in]: ids
        }
      },
      order: [["createdAt", "ASC"]]
    });
  }

  /** Mensagem com o ticket (e contato do ticket) — exclusão de mensagem. */
  public async findByIdWithTicketAndContact(
    id: string
  ): Promise<Message | null> {
    return Message.findByPk(id, {
      include: [
        {
          model: Ticket,
          as: "ticket",
          include: ["contact"]
        }
      ]
    });
  }
}
