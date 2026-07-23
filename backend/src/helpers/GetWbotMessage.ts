import { proto } from "baileys";
import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";
import GetMessageService from "../services/MessageServices/GetMessagesService";
import Message from "../models/Message";

export const GetWbotMessage = async (
  ticket: Ticket,
  messageId: string
): Promise<proto.WebMessageInfo | Message> => {
  try {
    const msgFound = await GetMessageService({ id: messageId });

    if (!msgFound) {
      throw new Error(`Message ${messageId} not found`);
    }

    return msgFound;
  } catch (err) {
    throw new AppError("ERR_FETCH_WAPP_MSG");
  }
};

export default GetWbotMessage;
