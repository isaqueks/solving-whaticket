import { proto } from "baileys";
import moment from "moment";
import { Op } from "sequelize";

import { getIO } from "../../libs/socket";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { campaignQueue, parseToMilliseconds, randomValue } from "../../queues";
import { getBodyMessage } from "./wbotMessageParser";

export const verifyRecentCampaign = async (
  message: proto.IWebMessageInfo,
  companyId: number
) => {
  if (message.key.fromMe) return;

  const number = message.key.remoteJid.replace(/\D/g, "");
  const campaigns = await Campaign.findAll({
    where: { companyId, status: "EM_ANDAMENTO", confirmation: true },
  });

  if (campaigns.length === 0) return;

  const ids = campaigns.map((c) => c.id);
  const campaignShipping = await CampaignShipping.findOne({
    where: { campaignId: { [Op.in]: ids }, number, confirmation: null },
  });

  if (!campaignShipping) return;

  await campaignShipping.update({
    confirmedAt: moment(),
    confirmation: true,
  });
  await campaignQueue.add(
    "DispatchCampaign",
    {
      campaignShippingId: campaignShipping.id,
      campaignId: campaignShipping.campaignId,
    },
    {
      delay: parseToMilliseconds(randomValue(0, 10)),
    }
  );
};

export const verifyCampaignMessageAndCloseTicket = async (
  message: proto.IWebMessageInfo,
  companyId: number
) => {
  const io = getIO();
  const body = getBodyMessage(message);
  const isCampaign = /\u200c/.test(body);

  if (!message.key.fromMe || !isCampaign) return;

  const messageRecord = await Message.findOne({
    where: { id: message.key.id!, companyId },
  });
  if (!messageRecord) {
    return;
  }
  const ticket = await Ticket.findByPk(messageRecord.ticketId);
  if (!ticket) {
    return;
  }
  await ticket.update({ status: "closed" });

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
