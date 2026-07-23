import moment from "moment";

import formatBody from "../../shared/helpers/Mustache";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { logger } from "../../utils/logger";

import Ticket from "../tickets/models/Ticket";
import { TicketsRepository } from "../tickets/TicketsRepository";
// Ciclo TicketsService ⇄ módulo da sessão: usar o singleton SEMPRE dentro do
// corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { ticketsService } from "../tickets/TicketsService";
// Idem para o WhatsappService.
import { whatsappService } from "../whatsapp/WhatsappService";

// Colaboradores internos do módulo referenciados só em tempo de chamada (o
// sender e a persistência participam do ciclo tickets ⇄ whatsapp-session).
import { messagePersistenceService } from "./MessagePersistenceService";
import { whatsappMessageSender } from "./WhatsappMessageSender";

/**
 * Fechamento automático de tickets abertos inativos, com a mensagem de
 * encerramento configurada na conexão (antigo `wbotClosedTickets` —
 * `ClosedAllOpenTickets`). O agendamento cron vive em jobs/JobScheduler (tick em jobs/TicketSweepProcessor).
 * Lógica preservada linha a linha.
 */
export class TicketAutoCloser {
  constructor(
    private readonly ticketsRepository = new TicketsRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async closeAllOpenTickets(companyId: number): Promise<void> {
    try {
      const { rows: tickets } = await this.ticketsRepository.findAndCountOpenByCompany(
        companyId
      );

      for (const ticket of tickets) {
        const showTicket = await ticketsService.show(ticket.id, companyId);
        const whatsapp = showTicket?.whatsappId
          ? await whatsappService.findByIdWithoutSession(showTicket.whatsappId)
          : null;
        const ticketTraking = await this.ticketsRepository.findOpenTraking(
          ticket.id
        );

        if (!whatsapp) continue;

        let {
          expiresInactiveMessage, //mensage de encerramento por inatividade
          expiresTicket //tempo em horas para fechar ticket automaticamente
        } = whatsapp

        // O model declara number, mas o valor pode chegar como string do banco
        // — o alias alargado preserva as comparações originais sem @ts-ignore.
        const expiresTicketRaw = expiresTicket as unknown as number | string;

        if (expiresTicketRaw && expiresTicketRaw !== "" &&
          expiresTicketRaw !== "0" && Number(expiresTicketRaw) > 0) {

          //mensagem de encerramento por inatividade
          const bodyExpiresMessageInactive = formatBody(`\u200e ${expiresInactiveMessage}`, showTicket.contact);

          const dataLimite = new Date()
          dataLimite.setMinutes(dataLimite.getMinutes() - Number(expiresTicket));

          if (showTicket.status === "open" && !showTicket.isGroup) {

            const dataUltimaInteracaoChamado = new Date(showTicket.updatedAt)

            if (dataUltimaInteracaoChamado < dataLimite && showTicket.fromMe) {

              if (expiresInactiveMessage !== "" && expiresInactiveMessage !== undefined) {
                const sentMessage = await whatsappMessageSender.sendText({
                  body: bodyExpiresMessageInactive,
                  ticket: showTicket,
                  userId: showTicket.userId
                });

                await messagePersistenceService.verifyMessage(sentMessage, showTicket, showTicket.contact);
              }

              await this.closeTicket(showTicket, showTicket.status);

              if (ticketTraking) {
                await this.ticketsRepository.updateTrakingInstance(ticketTraking, {
                  finishedAt: moment().toDate(),
                  closedAt: moment().toDate(),
                  whatsappId: ticket.whatsappId,
                  userId: ticket.userId,
                })
              }

              this.realtime.emitTicketToLegacyOpenRoom(companyId, {
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

  private async closeTicket(
    ticket: Ticket,
    currentStatus: string
  ): Promise<void> {
    // Nos status "nps"/"open" também zera o contador de uso do bot
    // (campo correto: amountUsedBotQueues — o typo antigo era ignorado pelo Sequelize)
    const resetBotCounter = currentStatus === "nps" || currentStatus === "open";

    await this.ticketsRepository.updateInstance(ticket, {
      status: "closed",
      unreadMessages: 0,
      ...(resetBotCounter ? { amountUsedBotQueues: 0 } : {})
    });
  }
}

export const ticketAutoCloser = new TicketAutoCloser();
