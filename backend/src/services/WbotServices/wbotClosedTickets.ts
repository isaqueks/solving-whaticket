import { Op } from "sequelize";
import Ticket from "../../models/Ticket"
import Whatsapp from "../../models/Whatsapp"
import { getIO } from "../../libs/socket"
import formatBody from "../../helpers/Mustache";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import moment from "moment";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { verifyMessage } from "./wbotMessagePersistence";
import TicketTraking from "../../models/TicketTraking";
import { logger } from "../../utils/logger";

export const ClosedAllOpenTickets = async (companyId: number): Promise<void> => {

  const closeTicket = async (ticket: any, currentStatus: any) => {
    // Nos status "nps"/"open" também zera o contador de uso do bot
    // (campo correto: amountUsedBotQueues — o typo antigo era ignorado pelo Sequelize)
    const resetBotCounter = currentStatus === "nps" || currentStatus === "open";

    await ticket.update({
      status: "closed",
      unreadMessages: 0,
      ...(resetBotCounter ? { amountUsedBotQueues: 0 } : {})
    });
  };

  const io = getIO();
  try {

    const { rows: tickets } = await Ticket.findAndCountAll({
      where: { status: { [Op.in]: ["open"] }, companyId },
      order: [["updatedAt", "DESC"]]
    });

    for (const ticket of tickets) {
      const showTicket = await ShowTicketService(ticket.id, companyId);
      const whatsapp = await Whatsapp.findByPk(showTicket?.whatsappId, {
        attributes: { exclude: ["session"] }
      });
      const ticketTraking = await TicketTraking.findOne({
        where: {
          ticketId: ticket.id,
          finishedAt: null,
        }
      })

      if (!whatsapp) continue;

      let {
        expiresInactiveMessage, //mensage de encerramento por inatividade      
        expiresTicket //tempo em horas para fechar ticket automaticamente
      } = whatsapp


      // @ts-ignore: Unreachable code error
      if (expiresTicket && expiresTicket !== "" &&
        // @ts-ignore: Unreachable code error
        expiresTicket !== "0" && Number(expiresTicket) > 0) {

        //mensagem de encerramento por inatividade
        const bodyExpiresMessageInactive = formatBody(`\u200e ${expiresInactiveMessage}`, showTicket.contact);

        const dataLimite = new Date()
        dataLimite.setMinutes(dataLimite.getMinutes() - Number(expiresTicket));

        if (showTicket.status === "open" && !showTicket.isGroup) {

          const dataUltimaInteracaoChamado = new Date(showTicket.updatedAt)

          if (dataUltimaInteracaoChamado < dataLimite && showTicket.fromMe) {

            if (expiresInactiveMessage !== "" && expiresInactiveMessage !== undefined) {
              const sentMessage = await SendWhatsAppMessage({ body: bodyExpiresMessageInactive, ticket: showTicket, userId: showTicket.userId });

              await verifyMessage(sentMessage, showTicket, showTicket.contact);
            }

            await closeTicket(showTicket, showTicket.status);

            if (ticketTraking) {
              await ticketTraking.update({
                finishedAt: moment().toDate(),
                closedAt: moment().toDate(),
                whatsappId: ticket.whatsappId,
                userId: ticket.userId,
              })
            }

            io.to("open").emit(`company-${companyId}-ticket`, {
              action: "delete",
              ticketId: showTicket.id
            });

          }
        }
      }
    }

  } catch (e: any) {
    logger.error(`Erro ao fechar tickets automaticamente: ${e}`);
  }

}
