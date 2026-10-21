import { Op, fn, where, col, Filterable, Includeable } from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import User from "../../models/User";
import ShowUserService from "../UserServices/ShowUserService";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import { intersection } from "lodash";
import Whatsapp from "../../models/Whatsapp";
import AttachResponsibleUsers from "../ContactServices/AttachResponsibleUsers";

interface Request {
  searchParam?: string;
  pageNumber?: string;
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
  unread?: 'unread' | 'read';
  // "true": só tickets de contatos cujo responsável (Contacts.attachedToEmail)
  // é o usuário logado, independente de fila, status ou atendente atual
  myClients?: string;
}

interface Response {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

const ListTicketsService = async ({
  searchParam = "",
  pageNumber = "1",
  queueIds,
  tags,
  users,
  status,
  date,
  updatedAt,
  showAll,
  userId,
  withUnreadMessages,
  companyId,
  unread,
  myClients
}: Request): Promise<Response> => {
  let whereCondition: Filterable["where"] = {
    [Op.or]: [{ userId }, { status: "pending" }],
    queueId: { [Op.or]: [queueIds, null] }
  };

  // Filtro "Meus Clientes": o vínculo contato -> colaborador é por e-mail.
  // Sem e-mail (usuário inexistente) o filtro não casa com nenhum contato.
  let myClientsCondition: Filterable["where"] | null = null;
  if (myClients === "true") {
    const me = await User.findByPk(userId, { attributes: ["email"] });
    const email = (me?.email || "").trim().toLowerCase();
    if (!email) {
      // sem e-mail não há vínculo possível (null casaria com "sem responsável")
      return { tickets: [], count: 0, hasMore: false };
    }
    myClientsCondition = {
      "$contact.attachedToEmail$": where(
        fn("LOWER", col("contact.attachedToEmail")),
        email
      )
    };
  }
  let includeCondition: Includeable[];

  includeCondition = [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "email", "profilePicUrl", "attachedToEmail"]
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
    },
  ];

  if (showAll === "true") {
    whereCondition = { queueId: { [Op.or]: [queueIds, null] } };
  }

  if (myClientsCondition) {
    whereCondition = { ...myClientsCondition };
  }

  if (status) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }

  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

    // includeCondition = [
    //   ...includeCondition,
    //   {
    //     model: Message,
    //     as: "messages",
    //     attributes: ["id", "body"],
    //     where: {
    //       body: where(
    //         fn("LOWER", col("body")),
    //         "LIKE",
    //         `%${sanitizedSearchParam}%`
    //       )
    //     },
    //     required: false,
    //     duplicating: false
    //   }
    // ];

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
        { "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` } },
        // {
        //   "$message.body$": where(
        //     fn("LOWER", col("body")),
        //     "LIKE",
        //     `%${sanitizedSearchParam}%`
        //   )
        // }
      ]
    };
  }

  if (date) {
    whereCondition = {
      ...whereCondition,
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    };
  }

  if (updatedAt) {
    whereCondition = {
      ...whereCondition,
      updatedAt: {
        [Op.between]: [
          +startOfDay(parseISO(updatedAt)),
          +endOfDay(parseISO(updatedAt))
        ]
      }
    };
  }

  if (withUnreadMessages === "true") {
    const user = await ShowUserService(userId);
    const userQueueIds = user.queues.map(queue => queue.id);

    whereCondition = {
      [Op.or]: [{ userId }, { status: "pending" }],
      queueId: { [Op.or]: [userQueueIds, null] },
      unreadMessages: { [Op.gt]: 0 }
    };

    if (myClientsCondition) {
      whereCondition = {
        ...myClientsCondition,
        unreadMessages: { [Op.gt]: 0 }
      };
    }
  }

  if (unread) {
    whereCondition = {
      ...whereCondition,
      unreadMessages: (unread === 'unread') ? { [Op.gt]: 0 } : 0
    };
  }

  if (Array.isArray(tags) && tags.length > 0) {
    const ticketsTagFilter: any[] | null = [];
    for (let tag of tags) {
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
    const ticketsUserFilter: any[] | null = [];
    for (let user of users) {
      const ticketUsers = await Ticket.findAll({
        where: { userId: user, companyId },
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

  const limit = 100;
  const offset = limit * (+pageNumber - 1);

  whereCondition = {
    ...whereCondition,
    companyId
  };

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

  // responsável pelo contato (badge na lista), resolvido em uma consulta
  await AttachResponsibleUsers(tickets.map(t => t.contact), companyId);

  return {
    tickets,
    count,
    hasMore
  };
};

export default ListTicketsService;