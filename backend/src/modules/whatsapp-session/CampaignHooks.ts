import { proto } from "baileys";
import moment from "moment";

import { campaignQueue } from "../../queues/connection";
import { parseToMilliseconds, randomValue } from "../../queues/lib";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";

import { CampaignsRepository } from "../campaigns/CampaignsRepository";
import { MessagesRepository } from "../messages/MessagesRepository";
import { TicketsRepository } from "../tickets/TicketsRepository";

import { MessageParser } from "./MessageParser";

/**
 * Ganchos de campanha no fluxo de mensagens do wbot (antigo
 * `wbotCampaignHooks`): confirmação de recebimento de campanha e fechamento do
 * ticket criado pelo disparo. Lógica preservada; leituras de campanha via
 * CampaignsRepository (B6) e eventos via RealtimeGateway. A instância Bull
 * vem direto de queues/connection (import de infra, sem ciclo com o barrel).
 */
export class CampaignHooks {
  constructor(
    private readonly campaignsRepository = new CampaignsRepository(),
    private readonly messagesRepository = new MessagesRepository(),
    private readonly ticketsRepository = new TicketsRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async verifyRecentCampaign(
    message: proto.IWebMessageInfo,
    companyId: number
  ): Promise<void> {
    if (message.key.fromMe) return;

    const number = message.key.remoteJid.replace(/\D/g, "");
    const campaigns =
      await this.campaignsRepository.findAllInProgressWithConfirmation(
        companyId
      );

    if (campaigns.length === 0) return;

    const ids = campaigns.map((c) => c.id);
    const campaignShipping =
      await this.campaignsRepository.findShippingPendingConfirmation(
        ids,
        number
      );

    if (!campaignShipping) return;

    await this.campaignsRepository.updateShippingInstance(campaignShipping, {
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
  }

  public async verifyCampaignMessageAndCloseTicket(
    message: proto.IWebMessageInfo,
    companyId: number
  ): Promise<void> {
    const body = MessageParser.getBodyMessage(message);
    const isCampaign = /\u200c/.test(body);

    if (!message.key.fromMe || !isCampaign) return;

    const messageRecord = await this.messagesRepository.findByIdAndCompany(
      message.key.id!,
      companyId
    );
    if (!messageRecord) {
      return;
    }
    const ticket = await this.ticketsRepository.findById(
      messageRecord.ticketId
    );
    if (!ticket) {
      return;
    }
    await this.ticketsRepository.updateInstance(ticket, { status: "closed" });

    this.realtime.emitTicketToStatusRooms(
      {
        companyId: ticket.companyId,
        status: "open",
        queueId: ticket.queueId
      },
      {
        action: "delete",
        ticket,
        ticketId: ticket.id,
      }
    );

    this.realtime.emitTicketToStatusRooms(
      {
        companyId: ticket.companyId,
        status: ticket.status,
        queueId: ticket.queueId,
        ticketId: ticket.id.toString()
      },
      {
        action: "update",
        ticket,
        ticketId: ticket.id,
      }
    );
  }
}

export const campaignHooks = new CampaignHooks();
