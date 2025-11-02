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
import { processAudio } from "./SendWhatsAppMedia";

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

    const fileName = message.mediaUrl ? message.mediaUrl.split('/').pop() : null;

    if (['conversation', 'editedMessage', 'extendedTextMessage'].includes(message.mediaType)) {
      await wbot.sendMessage(jid, { text: message.body });
    }
    else if (['audio', 'image', 'application', 'video'].includes(message.mediaType)) {
      const mimeType = mime.lookup(message.mediaUrl);
      const opt = {
        fileName: fileName,
        caption: message.body,
        mimetype: mimeType || 'application'
      } as any;

      if (message.mediaType === 'audio') {
        opt.audio = await fs.promises.readFile(`${publicFolder}/${fileName}`);
        opt.ptt = true
        opt.mimetype = 'audio/ogg; codecs=opus';
      } else if (message.mediaType === 'image') {
        opt.image = await fs.promises.readFile(`${publicFolder}/${fileName}`);
      } else if (message.mediaType === 'application') {
        opt.document = await fs.promises.readFile(`${publicFolder}/${fileName}`);
      } else if (message.mediaType === 'video') {
        opt.video = await fs.promises.readFile(`${publicFolder}/${fileName}`);
      }

      await wbot.sendMessage(jid, {
        ...opt,
      });

      await sleep(1500);
    }
  }
  
};

export default ForwardWhatsAppMessage;
