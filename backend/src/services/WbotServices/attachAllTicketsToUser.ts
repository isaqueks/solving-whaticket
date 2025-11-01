import { IsNull } from "sequelize-typescript";
import Ticket from "../../models/Ticket";
import { Op } from "sequelize";
import User from "../../models/User";
import { getIO } from "../../libs/socket";

const QUEUE_FALAR_COM_ATENDENTE = 1;

export async function attachAllTicketsToUser(companyId: number) {

  const nonAttached = await Ticket.findAll({
    where: {
      userId: {
        [Op.is]: null
      },
      companyId,
      queueId: QUEUE_FALAR_COM_ATENDENTE,
      contact: {
        attachedToEmail: { [Op.not]: null }
      }
    },
    include: [
      'contact'
    ]
  });

  const io = getIO();

  const userCache = new Map<string, User>();
  async function getCachedUserByEmail(email: string, companyId: number): Promise<User | null> {
    if (userCache.has(email)) {
      return userCache.get(email) || null;
    }

    const user = await User.findOne({
      where: {
        email,
        companyId
      }
    });

    userCache.set(email, user);
    return user;
  }

  for (const ticket of nonAttached) {
    if (ticket.contact.attachedToEmail) {
      const user = await getCachedUserByEmail(ticket.contact.attachedToEmail, companyId);

      if (user) {
        await ticket.update({
          userId: user.id
        });

        io.to("open").emit(`company-${companyId}-ticket`, {
          action: "update",
          ticket
        });
      }
    }
  }

}