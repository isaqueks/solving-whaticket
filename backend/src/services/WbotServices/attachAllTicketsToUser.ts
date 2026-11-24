import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import ShowTicketService from "../TicketServices/ShowTicketService";
import AttachResponsibleUsers from "../ContactServices/AttachResponsibleUsers";

/**
 * Rede de segurança (cron de 10 min): mantém atendente (Tickets.userId) igual
 * ao responsável do contato (Contacts.attachedToEmail, e-mail exato como no
 * UpdateTicketService, para os dois não se desfazerem) nos tickets não
 * encerrados e que não são de grupo.
 *
 * 1. Sem atendente: atribui ao responsável, mas só se o ticket já está numa
 *    fila. Sem fila o chatbot de filas ainda está rodando (ele só roda com
 *    userId nulo) e atribuir aqui interromperia o menu.
 * 2. Com atendente diferente do responsável (ex.: o responsável mudou no
 *    sync): troca para o responsável, com ou sem fila, porque uma pessoa já
 *    assumiu o ticket (chamado #98).
 *
 * Em ambos ficam de fora os tickets em integração/prompt (typebot, OpenAI) e
 * os contatos cujo e-mail não corresponde a nenhum usuário da empresa. Só o
 * userId muda: status, leitura e mensagens ao cliente não são tocados.
 */
export async function attachAllTicketsToUser(companyId: number) {
  const candidates = await Ticket.findAll({
    where: {
      companyId,
      status: { [Op.ne]: "closed" },
      isGroup: { [Op.not]: true },
      useIntegration: { [Op.not]: true },
      promptId: { [Op.is]: null }
    },
    include: [
      {
        association: "contact",
        required: true,
        where: {
          attachedToEmail: { [Op.not]: null }
        }
      }
    ]
  });

  const io = getIO();

  const userCache = new Map<string, User | null>();
  async function getCachedUserByEmail(email: string): Promise<User | null> {
    if (userCache.has(email)) {
      return userCache.get(email) || null;
    }

    const user = await User.findOne({
      where: { companyId, email }
    });

    userCache.set(email, user);
    return user;
  }

  for (const ticket of candidates) {
    try {
      const email = ticket.contact.attachedToEmail;
      if (!email) continue;

      const user = await getCachedUserByEmail(email);
      if (!user || ticket.userId === user.id) continue;

      // caso 1 sem fila: o chatbot de filas ainda está atendendo
      if (!ticket.userId && !ticket.queueId) continue;

      const oldUserId = ticket.userId;
      await ticket.update({ userId: user.id });

      const fullTicket = await ShowTicketService(ticket.id, companyId);
      await AttachResponsibleUsers([fullTicket.contact], companyId);

      io.to(`company-${companyId}-${fullTicket.status}`)
        .to(`queue-${fullTicket.queueId}-${fullTicket.status}`)
        .to(fullTicket.id.toString())
        .to(`user-${user.id}`)
        .to(`user-${oldUserId}`)
        .emit(`company-${companyId}-ticket`, {
          action: "update",
          ticket: fullTicket
        });
    } catch (err: any) {
      logger.error(
        `attachAllTicketsToUser: ticket ${ticket.id} (empresa ${companyId}): ${err?.message}`
      );
    }
  }
}
