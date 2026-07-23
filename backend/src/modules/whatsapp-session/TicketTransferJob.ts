import moment from "moment";

import { realtimeGateway } from "../../shared/realtime/RealtimeGateway";
import { logger } from "../../utils/logger";

import { TicketsRepository } from "../tickets/TicketsRepository";
// Ciclo TicketsService ⇄ módulo da sessão: usar o singleton SEMPRE dentro do
// corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { ticketsService } from "../tickets/TicketsService";
// Idem para o WhatsappService.
import { whatsappService } from "../whatsapp/WhatsappService";

/**
 * Transferência automática de tickets pendentes sem fila para a fila
 * configurada na conexão após o tempo limite (antigo
 * `wbotTransferTicketQueue.ts` da raiz). O agendamento cron continua no
 * bootstrap (`server.ts`), como antes. Lógica preservada.
 */
export class TicketTransferJob {
  constructor(private readonly ticketsRepository = new TicketsRepository()) {}

  public async execute(): Promise<void> {
    //buscar os tickets que em pendentes e sem fila
    const tickets = await this.ticketsRepository.findPendingWithoutQueue();

    // varrer os tickets e verificar se algum deles está com o tempo estourado
    for (const ticket of tickets) {
      const wpp = await whatsappService.findByIdWithoutSession(
        ticket.whatsappId
      );

      if (!wpp || !wpp.timeToTransfer || !wpp.transferQueueId || wpp.timeToTransfer == 0) continue;

      let dataLimite = new Date(ticket.updatedAt);
      dataLimite.setMinutes(dataLimite.getMinutes() + wpp.timeToTransfer);

      if (new Date() > dataLimite) {
        await this.ticketsRepository.updateInstance(ticket, {
          queueId: wpp.transferQueueId,
        });

        const ticketTraking = await this.ticketsRepository.findLatestTrakingByTicket(
          ticket.id
        );

        if (ticketTraking) {
          await this.ticketsRepository.updateTrakingInstance(ticketTraking, {
            queuedAt: moment().toDate(),
            queueId: wpp.transferQueueId,
          });
        }

        const currentTicket = await ticketsService.show(ticket.id, ticket.companyId);

        // Piloto B0.2: emissão via RealtimeGateway para o conjunto padrão de
        // salas (status/notification da empresa e da fila + sala do ticket) —
        // salas, evento e payload idênticos aos anteriores.
        realtimeGateway.emitTicketChanged({
          companyId: ticket.companyId,
          status: ticket.status,
          queueId: wpp.transferQueueId,
          ticketId: ticket.id,
          payload: {
            action: "update",
            ticket: currentTicket
          }
        });

        logger.info(`Transferencia de ticket automatica ticket id ${ticket.id} para a fila ${wpp.transferQueueId}`);
      }
    }
  }
}

export const ticketTransferJob = new TicketTransferJob();
