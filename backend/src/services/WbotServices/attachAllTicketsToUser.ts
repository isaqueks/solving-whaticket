import { IsNull } from "sequelize-typescript";
import Ticket from "../../models/Ticket";
import { Op } from "sequelize";
import User from "../../models/User";
import { getIO } from "../../libs/socket";

/**
 * Rede de segurança (cron de 10 min): devolve ao colaborador responsável
 * (Contacts.attachedToEmail) os tickets que ficaram sem usuário já dentro de
 * uma fila, em qualquer fila. O caminho normal é o UpdateTicketService, que
 * grava o responsável sempre que o ticket entra numa fila; aqui entram os
 * casos que gravam a fila direto (ex.: transferência por tempo).
 *
 * Fica de fora:
 * - ticket sem fila: o chatbot de filas só roda com userId nulo; atribuir aqui
 *   interromperia o menu;
 * - ticket em integração/prompt (typebot, OpenAI): a automação ainda atende;
 * - ticket encerrado.
 */
export async function attachAllTicketsToUser(companyId: number) {

  const nonAttached = await Ticket.findAll({
    where: {
      userId: {
        [Op.is]: null
      },
      companyId,
      queueId: { [Op.not]: null },
      useIntegration: { [Op.not]: true },
      promptId: { [Op.is]: null },
      status: { [Op.ne]: "closed" }
    },
    include: [
      {
        association: 'contact',
        required: true, // INNER JOIN (coloca false se quiser LEFT)
        where: {
          attachedToEmail: { [Op.not]: null }
        }
      }
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