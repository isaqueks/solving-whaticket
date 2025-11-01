import { WAMessage } from "baileys";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import { getContactJid } from "../../helpers/getContactJid";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import { Op } from "sequelize";
import mime from "mime-types";
import path from "path";
import fs from 'fs';

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

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
  const jid = getContactJid(contact);
  for (const message of messages) {
    if (['conversation', 'editedMessage', 'extendedTextMessage'].includes(message.mediaType)) {
      await wbot.sendMessage(jid, { text: message.body });
    }
    else if (['audio', 'image', 'application', 'video'].includes(message.mediaType)) {
      const mimeType = mime.lookup(message.mediaUrl);
      const opt = {
        fileName: message.mediaUrl.split('/').pop(),
        caption: message.body,
        mimetype: mimeType || 'application'
      } as any;

      if (message.mediaType === 'audio') {
        opt.audio = fs.createReadStream(`${publicFolder}/${message.mediaUrl}`);
        opt.ptt = message.mediaType === 'audio' && mime.lookup(message.mediaUrl) === 'audio/ogg' ? true : false;
      } else if (message.mediaType === 'image') {
        opt.image = fs.createReadStream(`${publicFolder}/${message.mediaUrl}`);
      } else if (message.mediaType === 'application') {
        opt.document = fs.createReadStream(`${publicFolder}/${message.mediaUrl}`);
      } else if (message.mediaType === 'video') {
        opt.video = fs.createReadStream(`${publicFolder}/${message.mediaUrl}`);
      }

      await wbot.sendMessage(jid, {
        ...opt,
      });

      await sleep(1000); // wait 1 second between messages to avoid spamming
    }
  }
  
};

export default ForwardWhatsAppMessage;
