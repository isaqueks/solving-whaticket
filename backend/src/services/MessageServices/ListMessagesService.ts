import { FindOptions, Includeable } from "sequelize/types";
import { Op, literal } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import Queue from "../../models/Queue";
import sequelize from "../../database";

interface Request {
  ticketId: string;
  companyId: number;
  pageNumber?: string;
  queues?: number[];
  // Cursores opcionais e mutuamente exclusivos (ids de mensagem do ticket)
  aroundId?: string;
  beforeId?: string;
  afterId?: string;
}

interface Response {
  messages: Message[];
  ticket: Ticket;
  count?: number;
  hasMore: boolean;
  hasNewer: boolean;
}

const AROUND_SIZE = 20;

const ListMessagesService = async ({
  pageNumber = "1",
  ticketId,
  companyId,
  queues = [],
  aroundId,
  beforeId,
  afterId
}: Request): Promise<Response> => {
  const ticket = await ShowTicketService(ticketId, companyId);

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // await setMessagesAsRead(ticket);
  const limit = 22;
  const offset = limit * (+pageNumber - 1);

  const options: FindOptions = {
    where: {
      ticketId,
      companyId
    }
  };

  if (queues.length > 0) {
    options.where["queueId"] = {
      [Op.or]: {
        [Op.in]: queues,
        [Op.eq]: null
      }
    };
  }

  const include: Includeable[] = [
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
  ];

  const cursors = [aroundId, beforeId, afterId].filter(Boolean);

  if (cursors.length === 0) {
    const { count, rows: messages } = await Message.findAndCountAll({
      ...options,
      limit,
      include,
      offset,
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"]
      ]
    });

    const hasMore = count > offset + messages.length;

    return {
      messages: messages.reverse(),
      ticket,
      count,
      hasMore,
      hasNewer: false
    };
  }

  if (cursors.length > 1) {
    throw new AppError("ERR_INVALID_MESSAGE_CURSOR", 400);
  }

  const cursorId = String(cursors[0]);

  // O cursor precisa ser uma mensagem visível deste ticket/empresa.
  const cursor = await Message.findOne({
    where: { ...options.where, id: cursorId },
    attributes: ["id"]
  });

  if (!cursor) {
    throw new AppError("ERR_NO_MESSAGE_FOUND", 404);
  }

  // Compara a tupla ("createdAt", id) com a do cursor direto no SQL: a coluna
  // tem microssegundos e o Date do JS truncaria para milissegundos.
  const cursorRow = `(SELECT "createdAt", id FROM "Messages" WHERE id = ${sequelize.escape(
    cursorId
  )})`;

  // Busca "size" mensagens a partir do cursor numa direção (+1 para saber se
  // há mais), já devolvendo em ordem cronológica crescente.
  const fetchFrom = async (
    operator: "<" | "<=" | ">",
    size: number
  ): Promise<{ rows: Message[]; more: boolean }> => {
    const older = operator !== ">";
    const direction = older ? "DESC" : "ASC";

    const rows = await Message.findAll({
      where: {
        ...options.where,
        [Op.and]: [
          literal(
            `("Message"."createdAt", "Message"."id") ${operator} ${cursorRow}`
          )
        ]
      },
      include,
      limit: size + 1,
      order: [
        ["createdAt", direction],
        ["id", direction]
      ]
    });

    const more = rows.length > size;
    const page = rows.slice(0, size);

    return { rows: older ? page.reverse() : page, more };
  };

  if (aroundId) {
    // alvo + 20 mais antigas (<=) e 20 mais novas (>)
    const [before, after] = await Promise.all([
      fetchFrom("<=", AROUND_SIZE + 1),
      fetchFrom(">", AROUND_SIZE)
    ]);

    return {
      messages: [...before.rows, ...after.rows],
      ticket,
      hasMore: before.more,
      hasNewer: after.more
    };
  }

  if (beforeId) {
    const { rows, more } = await fetchFrom("<", limit);
    // o próprio cursor é mais novo que as devolvidas
    return { messages: rows, ticket, hasMore: more, hasNewer: true };
  }

  const { rows, more } = await fetchFrom(">", limit);
  // o próprio cursor é mais antigo que as devolvidas
  return { messages: rows, ticket, hasMore: true, hasNewer: more };
};

export default ListMessagesService;
