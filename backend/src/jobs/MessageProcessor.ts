import * as Sentry from "@sentry/node";
import { Job } from "bull";

import {
  MessageData,
  whatsappMessageSender
} from "../modules/whatsapp-session/WhatsappMessageSender";
import { WhatsappRepository } from "../modules/whatsapp/WhatsappRepository";
import { logger } from "../utils/logger";

/**
 * Processor do job "SendMessage" da MessageQueue (antigo
 * queues/messageJobs.ts) — comportamento preservado; acesso ao model via
 * WhatsappRepository.
 */
export class MessageProcessor {
  constructor(
    private readonly whatsappRepository = new WhatsappRepository()
  ) {}

  public sendMessage = async (job: Job): Promise<void> => {
    try {
      const { data } = job;

      const whatsapp = await this.whatsappRepository.findByIdWithoutSession(
        data.whatsappId
      );

      if (whatsapp == null) {
        throw Error("Whatsapp não identificado");
      }

      const messageData: MessageData = data.data;

      await whatsappMessageSender.sendRaw(whatsapp, messageData);
    } catch (e) {
      Sentry.captureException(e);
      logger.error("MessageQueue -> SendMessage: error", (e as Error).message);
      throw e;
    }
  };
}

export const messageProcessor = new MessageProcessor();
