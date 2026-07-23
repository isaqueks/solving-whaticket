import Ticket from "../models/Ticket";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";

const UpdateDeletedUserOpenTicketsStatus = async (
  tickets: Ticket[],
  companyId: number
): Promise<void> => {
  for (const t of tickets) {
    const ticketId = t.id.toString();

    await UpdateTicketService({
      ticketData: { status: "pending" },
      ticketId,
      companyId
    });
  }
};

export default UpdateDeletedUserOpenTicketsStatus;
