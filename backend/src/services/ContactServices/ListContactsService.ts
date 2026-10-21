import { Sequelize, Op } from "sequelize";
import Contact from "../../models/Contact";
import User from "../../models/User";
import AttachResponsibleUsers from "./AttachResponsibleUsers";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number;
  group?: string;
  // "true": só contatos cujo responsável (attachedToEmail) é o usuário `userId`
  myPortfolio?: string;
  userId?: number;
}

interface Response {
  contacts: Contact[];
  count: number;
  hasMore: boolean;
}

const ListContactsService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  group = "",
  myPortfolio,
  userId
}: Request): Promise<Response> => {
  const whereCondition = {
    [Op.or]: [
      {
        name: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("name")),
          "LIKE",
          `%${searchParam.toLowerCase().trim()}%`
        )
      },
      { number: { [Op.like]: `%${searchParam.toLowerCase().trim()}%` } },
      { taxId: { [Op.like]: `%${searchParam.toLowerCase().trim()}%` } }
    ],
    companyId: {
      [Op.eq]: companyId
    }
  };

  
  let limit = 30;
  if (group) {
    limit = 200;
    whereCondition['isGroup'] = {
      [Op.eq]: (group === 'true')
    };
  }

  if (myPortfolio === "true") {
    const me = userId
      ? await User.findByPk(userId, { attributes: ["email"] })
      : null;
    const email = (me?.email || "").trim().toLowerCase();
    if (!email) {
      // sem e-mail não há vínculo possível (null casaria com "sem responsável")
      return { contacts: [], count: 0, hasMore: false };
    }
    whereCondition["attachedToEmail"] = Sequelize.where(
      Sequelize.fn("LOWER", Sequelize.col("attachedToEmail")),
      email
    );
  }

  const offset = limit * (+pageNumber - 1);

  const { count, rows: contacts } = await Contact.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["name", "ASC"]]
  });

  const hasMore = count > offset + contacts.length;

  await AttachResponsibleUsers(contacts, companyId);

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListContactsService;
