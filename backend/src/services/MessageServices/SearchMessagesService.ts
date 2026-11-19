import { QueryTypes } from "sequelize";
import sequelize from "../../database";

interface Request {
  searchParam?: string;
  companyId: number;
  ticketId?: string;
  pageNumber?: string;
  isAdmin: boolean;
  queues: number[];
}

interface SearchResult {
  id: string;
  body: string;
  fromMe: boolean;
  mediaType: string;
  createdAt: Date;
  ticketId: number;
  ticket: {
    id: number;
    uuid: string;
    status: string;
    isGroup: boolean;
    contact: {
      id: number;
      name: string;
      number: string;
      profilePicUrl: string;
    };
  };
  contact: { id: number; name: string } | null;
}

interface Response {
  messages: SearchResult[];
  hasMore: boolean;
}

const MIN_TERM_LENGTH = 3; // com 2 caracteres o índice de trigramas não ajuda
const LIMIT = 40;

// Escapa os curingas do LIKE para o termo do usuário ser buscado literalmente.
const escapeLike = (term: string): string => term.replace(/[\\%_]/g, "\\$&");

const SearchMessagesService = async ({
  searchParam = "",
  companyId,
  ticketId,
  pageNumber = "1",
  isAdmin,
  queues
}: Request): Promise<Response> => {
  const term = searchParam.trim();

  const ticketIdNumber = ticketId ? Number(ticketId) : null;

  // não-admin sem fila não consegue abrir nenhum ticket (tela Ticket)
  if (
    term.length < MIN_TERM_LENGTH ||
    (ticketIdNumber !== null && !Number.isInteger(ticketIdNumber)) ||
    (!isAdmin && queues.length === 0)
  ) {
    return { messages: [], hasMore: false };
  }

  const page = Math.max(parseInt(pageNumber, 10) || 1, 1);

  const conditions = [
    `m."companyId" = :companyId`,
    // Mesma expressão do índice idx_messages_body_search, senão ele não é usado.
    `f_unaccent_lower(m.body) LIKE f_unaccent_lower(:pattern)`,
    `m."isDeleted" IS NOT TRUE`,
    `m."mediaType" IS DISTINCT FROM 'reactionMessage'`
  ];

  if (ticketIdNumber !== null) {
    conditions.push(`m."ticketId" = :ticketId`);
  }

  // Não-admin: só o que consegue abrir. Tickets das suas filas (a tela Ticket
  // nega ticket sem fila a não-admin) e mensagens das suas filas ou sem fila
  // (como no ListMessages).
  if (!isAdmin) {
    conditions.push(`t."queueId" IN (:queues)`);
    conditions.push(`(m."queueId" IN (:queues) OR m."queueId" IS NULL)`);
  }

  const rows: any[] = await sequelize.query(
    /* sql */ `
    SELECT
      m.id, m.body, m."fromMe", m."mediaType", m."createdAt", m."ticketId",
      t.uuid AS "ticketUuid", t.status AS "ticketStatus",
      t."isGroup" AS "ticketIsGroup",
      tc.id AS "ticketContactId", tc.name AS "ticketContactName",
      tc.number AS "ticketContactNumber",
      tc."profilePicUrl" AS "ticketContactProfilePicUrl",
      mc.id AS "contactId", mc.name AS "contactName"
    FROM "Messages" m
    JOIN "Tickets" t ON t.id = m."ticketId"
    LEFT JOIN "Contacts" tc ON tc.id = t."contactId"
    LEFT JOIN "Contacts" mc ON mc.id = m."contactId"
    WHERE ${conditions.join(" AND ")}
    ORDER BY m."createdAt" DESC, m.id DESC
    LIMIT :limit OFFSET :offset
    `,
    {
      type: QueryTypes.SELECT,
      replacements: {
        companyId,
        pattern: `%${escapeLike(term)}%`,
        ticketId: ticketIdNumber,
        queues,
        limit: LIMIT + 1,
        offset: LIMIT * (page - 1)
      }
    }
  );

  const hasMore = rows.length > LIMIT;

  const messages = rows.slice(0, LIMIT).map(row => ({
    id: row.id,
    body: row.body,
    fromMe: row.fromMe,
    mediaType: row.mediaType,
    createdAt: row.createdAt,
    ticketId: row.ticketId,
    ticket: {
      id: row.ticketId,
      uuid: row.ticketUuid,
      status: row.ticketStatus,
      isGroup: row.ticketIsGroup,
      contact: {
        id: row.ticketContactId,
        name: row.ticketContactName,
        number: row.ticketContactNumber,
        profilePicUrl: row.ticketContactProfilePicUrl
      }
    },
    contact: row.contactId ? { id: row.contactId, name: row.contactName } : null
  }));

  return { messages, hasMore };
};

export default SearchMessagesService;
