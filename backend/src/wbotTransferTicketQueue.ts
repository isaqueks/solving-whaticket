import { Op } from "sequelize";
import TicketTraking from "./models/TicketTraking";
import moment from "moment";
import Ticket from "./models/Ticket";
import Whatsapp from "./models/Whatsapp";
import { getIO } from "./libs/socket";
import { logger } from "./utils/logger";
import ShowTicketService from "./services/TicketServices/ShowTicketService";


export const TransferTicketQueue = async (): Promise<void> => {

  const io = getIO();

  //buscar os tickets que em pendentes e sem fila
  const tickets = await Ticket.findAll({
    where: {
      status: "pending",
      queueId: {
        [Op.is]: null
      },
    },

  });

  // varrer os tickets e verificar se algum deles está com o tempo estourado
  for (const ticket of tickets) {



    const wpp = await Whatsapp.findOne({
      where: {
        id: ticket.whatsappId
      },
      attributes: { exclude: ["session"] }
    });

    if (!wpp || !wpp.timeToTransfer || !wpp.transferQueueId || wpp.timeToTransfer == 0) continue;

    let dataLimite = new Date(ticket.updatedAt);
    dataLimite.setMinutes(dataLimite.getMinutes() + wpp.timeToTransfer);

    if (new Date() > dataLimite) {

      await ticket.update({

        queueId: wpp.transferQueueId,

      });

      const ticketTraking = await TicketTraking.findOne({
        where: {
          ticketId: ticket.id
        },
        order: [["createdAt", "DESC"]]
      });

      if (ticketTraking) {
        await ticketTraking.update({
          queuedAt: moment().toDate(),
          queueId: wpp.transferQueueId,
        });
      }

      const currentTicket = await ShowTicketService(ticket.id, ticket.companyId);

      // Salas com escopo por empresa/fila — o frontend não escuta as salas
      // genéricas ("pending"/"notification") que eram usadas antes
      io.to(`company-${ticket.companyId}-${ticket.status}`)
        .to(`company-${ticket.companyId}-notification`)
        .to(`queue-${wpp.transferQueueId}-${ticket.status}`)
        .to(`queue-${wpp.transferQueueId}-notification`)
        .to(ticket.id.toString())
        .emit(`company-${ticket.companyId}-ticket`, {
          action: "update",
          ticket: currentTicket
        });

      logger.info(`Transferencia de ticket automatica ticket id ${ticket.id} para a fila ${wpp.transferQueueId}`);

    }


  }


}
