import moment from "moment";

import formatBody from "../../helpers/Mustache";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import TicketTraking from "../../models/TicketTraking";
import UserRating from "../../models/UserRating";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import SendWhatsAppMessage from "./SendWhatsAppMessage";

export const verifyRating = (ticketTraking: TicketTraking) => {
  if (
    ticketTraking &&
    ticketTraking.finishedAt === null &&
    ticketTraking.userId !== null &&
    ticketTraking.ratingAt !== null
  ) {
    return true;
  }
  return false;
};

export const handleRating = async (
  rate: number,
  ticket: Ticket,
  ticketTraking: TicketTraking
) => {
  const io = getIO();

  const { complationMessage } = await ShowWhatsAppService(
    ticket.whatsappId,
    ticket.companyId
  );

  let finalRate = rate;

  if (rate < 1) {
    finalRate = 1;
  }
  if (rate > 5) {
    finalRate = 5;
  }

  await UserRating.create({
    ticketId: ticketTraking.ticketId,
    companyId: ticketTraking.companyId,
    userId: ticketTraking.userId,
    rate: finalRate,
  });

  if (complationMessage) {
    const body = formatBody(`\u200e${complationMessage}`, ticket.contact);
    await SendWhatsAppMessage({ body, ticket, userId: ticket.userId });
  }

  await ticketTraking.update({
    finishedAt: moment().toDate(),
    rated: true,
  });

  await ticket.update({
    queueId: null,
    chatbot: null,
    queueOptionId: null,
    userId: null,
    status: "closed",
  });

  io.to(`company-${ticket.companyId}-open`)
    .to(`queue-${ticket.queueId}-open`)
    .emit(`company-${ticket.companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id,
    });

  io.to(`company-${ticket.companyId}-${ticket.status}`)
    .to(`queue-${ticket.queueId}-${ticket.status}`)
    .to(ticket.id.toString())
    .emit(`company-${ticket.companyId}-ticket`, {
      action: "update",
      ticket,
      ticketId: ticket.id,
    });
};
