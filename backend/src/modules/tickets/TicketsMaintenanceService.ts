import { logger } from "../../utils/logger";
import { ContactsRepository } from "../contacts/ContactsRepository";
import { MessagesRepository } from "../messages/MessagesRepository";
import { TicketsRepository } from "./TicketsRepository";

/**
 * Varreduras administrativas do domínio (rota GET /fixTickets). Absorve o
 * antigo `services/fixTicket.ts` — recalcula lastMessage/updatedAt de todos os
 * tickets a partir da última mensagem registrada.
 */
export class TicketsMaintenanceService {
  constructor(
    private readonly repository = new TicketsRepository(),
    private readonly contactsRepository = new ContactsRepository(),
    private readonly messagesRepository = new MessagesRepository()
  ) {}

  public async fixTickets(): Promise<void> {
    const tickets = await this.repository.findAllForMaintenance();

    logger.info(`[FIX] Found ${tickets.length} tickets with wrong numbers.`);

    for (const ticket of tickets) {
      try {
        const contact = await this.contactsRepository.findById(ticket.contactId);
        if (!contact) {
          logger.info(
            `[FIX] Ticket ID ${ticket.id} contact ID ${ticket.contactId} not found. Skipping...`
          );
          continue;
        }

        const lastMessage = await this.messagesRepository.findLastByTicket(
          ticket.id
        );

        if (!lastMessage) {
          logger.info(`[FIX] Ticket ID ${ticket.id} has no messages. Skipping...`);
          continue;
        }

        await this.repository.updateInstance(ticket, {
          lastMessage: lastMessage.body,
          updatedAt: lastMessage.createdAt
        });
      } catch (err) {
        logger.error({ err }, "[FIX] Error processing ticket ID %d", ticket.id);
      }
    }
  }
}
