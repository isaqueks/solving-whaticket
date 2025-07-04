import { IsNull } from "sequelize-typescript";
import Ticket from "../../models/Ticket";
import { Op } from "sequelize";
import User from "../../models/User";
import { getIO } from "../../libs/socket";


export async function attachAllTicketsToUser(companyId: number) {

  const nonAttached = await Ticket.findAll({
    where: {
      userId: {
        [Op.eq]: null
      },
      companyId
    },
    include: [{ all: true }]
  });

  const io = getIO();

  for (const ticket of nonAttached) {
    if (ticket.contact.attachedToEmail) {
      const user = await User.findOne({
        where: {
          email: ticket.contact.attachedToEmail,
          companyId
        }
      });

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