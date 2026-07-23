import moment from "moment";

import formatBody from "../../shared/helpers/Mustache";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";

import Ticket from "../tickets/models/Ticket";
import TicketTraking from "../tickets/models/TicketTraking";
import { TicketsRepository } from "../tickets/TicketsRepository";
// Ciclo WhatsappService ⇄ módulo da sessão: usar o singleton SEMPRE dentro do
// corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { whatsappService } from "../whatsapp/WhatsappService";

// Colaborador interno do módulo também referenciado só em tempo de chamada
// (o sender participa do ciclo tickets ⇄ whatsapp-session).
import { whatsappMessageSender } from "./WhatsappMessageSender";

/**
 * Fluxo de avaliação do atendimento pelo cliente (antigo `wbotRating`):
 * detecta o traking aguardando nota e fecha o ticket registrando o rating.
 * Lógica preservada; eventos via RealtimeGateway.
 */
export class RatingService {
  constructor(
    private readonly ticketsRepository = new TicketsRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public verifyRating(ticketTraking: TicketTraking): boolean {
    if (
      ticketTraking &&
      ticketTraking.finishedAt === null &&
      ticketTraking.userId !== null &&
      ticketTraking.ratingAt !== null
    ) {
      return true;
    }
    return false;
  }

  public async handleRating(
    rate: number,
    ticket: Ticket,
    ticketTraking: TicketTraking
  ): Promise<void> {
    const { complationMessage } = await whatsappService.show(
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

    await this.ticketsRepository.createUserRating({
      ticketId: ticketTraking.ticketId,
      companyId: ticketTraking.companyId,
      userId: ticketTraking.userId,
      rate: finalRate
    });

    if (complationMessage) {
      const body = formatBody(`\u200e${complationMessage}`, ticket.contact);
      await whatsappMessageSender.sendText({
        body,
        ticket,
        userId: ticket.userId
      });
    }

    await this.ticketsRepository.updateTrakingInstance(ticketTraking, {
      finishedAt: moment().toDate(),
      rated: true
    });

    await this.ticketsRepository.updateInstance(ticket, {
      queueId: null,
      chatbot: null,
      queueOptionId: null,
      userId: null,
      status: "closed"
    });

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

export const ratingService = new RatingService();
