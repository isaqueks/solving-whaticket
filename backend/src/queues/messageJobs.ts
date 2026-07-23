import * as Sentry from "@sentry/node";
import { MessageData, SendMessage } from "../helpers/SendMessage";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";

export async function handleSendMessage(job) {
  try {
    const { data } = job;

    const whatsapp = await Whatsapp.findByPk(data.whatsappId, {
      attributes: { exclude: ["session"] }
    });

    if (whatsapp == null) {
      throw Error("Whatsapp não identificado");
    }

    const messageData: MessageData = data.data;

    await SendMessage(whatsapp, messageData);
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("MessageQueue -> SendMessage: error", e.message);
    throw e;
  }
}
