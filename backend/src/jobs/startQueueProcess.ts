import { appConfig } from "../config/AppConfig";
import { logger } from "../utils/logger";
import {
  campaignQueue,
  messageQueue,
  scheduleMonitor,
  sendScheduledMessages,
  userMonitor
} from "../queues/connection";
import { campaignProcessor } from "./CampaignProcessor";
import { loginStatusProcessor } from "./LoginStatusProcessor";
import { messageProcessor } from "./MessageProcessor";
import { scheduleProcessor } from "./ScheduleProcessor";

/**
 * Liga os processors às filas Bull e agenda os pollers repetitivos — mesmos
 * nomes de job, crons e chaves de repeat do arquivo original em queues/.
 * Chamado no boot (server.ts) DEPOIS da subida das sessões WhatsApp; roda só
 * na instância principal.
 */
export async function startQueueProcess(): Promise<void> {
  logger.info("Iniciando processamento de filas");

  if (!appConfig.server.isMainInstance) {
    logger.info("Cancelando início das filas, não é instância principal");
    return;
  }

  messageQueue.process("SendMessage", messageProcessor.sendMessage);

  scheduleMonitor.process("Verify", scheduleProcessor.verifySchedules);

  sendScheduledMessages.process(
    "SendMessage",
    scheduleProcessor.sendScheduledMessage
  );

  campaignQueue.process("VerifyCampaigns", campaignProcessor.verifyCampaigns);

  campaignQueue.process("ProcessCampaign", campaignProcessor.processCampaign);

  campaignQueue.process("PrepareContact", campaignProcessor.prepareContact);

  campaignQueue.process("DispatchCampaign", campaignProcessor.dispatchCampaign);

  userMonitor.process("VerifyLoginStatus", loginStatusProcessor.verifyLoginStatus);

  scheduleMonitor.add(
    "Verify",
    {},
    {
      repeat: { cron: "*/5 * * * * *", key: "verify" },
      removeOnComplete: true
    }
  );

  campaignQueue.add(
    "VerifyCampaigns",
    {},
    {
      repeat: { cron: "*/20 * * * * *", key: "verify-campaing" },
      removeOnComplete: true
    }
  );

  userMonitor.add(
    "VerifyLoginStatus",
    {},
    {
      repeat: { cron: "* * * * *", key: "verify-login" },
      removeOnComplete: true
    }
  );
}
