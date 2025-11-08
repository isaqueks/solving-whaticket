import { Sequelize, Op } from "sequelize";
import Contact from "../../models/Contact";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number;
  group?: string;
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
  group = ""
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

  const offset = limit * (+pageNumber - 1);

  const { count, rows: contacts } = await Contact.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["name", "ASC"]]
  });

  const hasMore = count > offset + contacts.length;

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListContactsService;
