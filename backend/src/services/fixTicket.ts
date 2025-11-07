import sequelize from "../database";
import Contact from "../models/Contact";
import Message from "../models/Message";
import Ticket from "../models/Ticket";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fixTickets() {
  const tickets = await Ticket.findAll();

  console.log(`[FIX] Found ${tickets.length} tickets with wrong numbers.`);

  for (const ticket of tickets) {
    try {

      const ctt = await Contact.findByPk(ticket.contactId);
      if (!ctt) {
        console.log(`[FIX] Ticket ID ${ticket.id} contact ID ${ticket.contactId} not found. Skipping...`);
        continue;
      }

      const lastMessage = await Message.findOne({
        where: { ticketId: ticket.id },
        order: [["createdAt", "DESC"]],
      });

      if (!lastMessage) {
        console.log(`[FIX] Ticket ID ${ticket.id} has no messages. Skipping...`);
        continue;
      }

      await ticket.update({
        lastMessage: lastMessage.body,
        updatedAt: lastMessage.createdAt
      });

    }
    catch (err) {
      console.error(`[FIX] Error processing ticket ID ${ticket.id}:`, err);
    }
  }
}