import AppError from "../../errors/AppError";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Ticket from "../../models/Ticket";
import ShowContactService from "../ContactServices/ShowContactService";
import { getIO } from "../../libs/socket";
import GetDefaultWhatsAppByUser from "../../helpers/GetDefaultWhatsAppByUser";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import User from "../../models/User";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";

interface Request {
  contactId: number;
  status: string;
  userId: number;
  companyId: number;
  queueId?: number;
  whatsappId?: string;
}

const CreateTicketService = async ({
  contactId,
  status,
  userId,
  queueId,
  companyId,
  whatsappId
}: Request): Promise<Ticket> => {
  let whatsapp;

  if (whatsappId !== undefined && whatsappId !== null && whatsappId !==  "") {
    whatsapp = await ShowWhatsAppService(whatsappId, companyId)
  }
  
  let defaultWhatsapp = await GetDefaultWhatsAppByUser(userId);

  if (whatsapp) {
    defaultWhatsapp = whatsapp;
  }
  if (!defaultWhatsapp)
    defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  await CheckContactOpenTickets(contactId, whatsappId);

  const { isGroup, attachedToEmail } = await ShowContactService(contactId, companyId);


  const [_ticket] = await Ticket.findOrCreate({
    where: {
      contactId,
      companyId,
      whatsappId
    },
    defaults: {
      contactId,
      companyId,
      whatsappId: defaultWhatsapp.id,
      status,
      isGroup,
      userId
    }
  });

  const { id } = _ticket;

  await Ticket.update(
    { companyId, queueId, userId, whatsappId: defaultWhatsapp.id, status: "open" },
    { where: { id } }
  );

  const ticket = await Ticket.findByPk(id, { include: ["contact", "queue"] });

  if (!ticket) {
    throw new AppError("ERR_CREATING_TICKET");
  }

  // if (attachedToEmail) {
  //   console.log('A')
  //   const user = await User.findOne({
  //     where: {
  //       companyId,
  //       email: attachedToEmail
  //     }
  //   });

  //   if (user) {
  //     console.log('U')
  //     const tag = await Tag.findOne({
  //       where: {
  //         name: user.name,
  //         companyId
  //       }
  //     });

  //     if (tag && !_ticket.tags.find(t => t.id === tag.id)) {
  //       console.log('T')
  //       await TicketTag.create({
  //         ticketId: id,
  //         tagId: tag.id
  //       })
  //     }
  //     else {
  //       console.log({ tag, _ticket })
  //     }
  //   }
  // }

  const io = getIO();

  io.to(ticket.id.toString()).emit("ticket", {
    action: "update",
    ticket
  });

  return ticket;
};

export default CreateTicketService;
