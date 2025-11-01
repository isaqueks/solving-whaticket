import { WAMessage } from "baileys";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import { getContactJid } from "../../helpers/getContactJid";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import { Op } from "sequelize";

interface Request {
  contactId: number;
  whatsappId?: number;
  messagesId: string[];
}

const ForwardWhatsAppMessage = async ({
  contactId,
  whatsappId,
  messagesId,
}: Request): Promise<void> => {


  const contact = await Contact.findByPk(contactId);
  if (!contact) {
    throw new AppError("Contact not found");
  }

  const wbot = await getWbot(whatsappId);

  const messages = await Message.findAll({
    where: {
      id: {
        [Op.in]: messagesId,
      },
    },
    order: [["createdAt", "ASC"]],
  });

  for (const message of messages) {
    await wbot.sendMessage(getContactJid(contact), {
      forward: JSON.parse(message.dataJson) as WAMessage
    });
  }
  
};

export default ForwardWhatsAppMessage;
