import { logger } from "../utils/logger";
import {
  campaignQueue,
  messageQueue,
  scheduleMonitor,
  sendScheduledMessages,
  userMonitor
} from "./connection";
import {
  handleDispatchCampaign,
  handlePrepareContact,
  handleProcessCampaign,
  handleVerifyCampaigns
} from "./campaignJobs";
import { handleSendMessage } from "./messageJobs";
import {
  handleSendScheduledMessage,
  handleVerifySchedules
} from "./scheduleJobs";
import { handleLoginStatus } from "./userMonitorJobs";

export async function startQueueProcess() {
  logger.info("Iniciando processamento de filas");

  if (process.env.PORT !== process.env.MAIN_PORT) {
    logger.info("Cancelando início das filas, não é instância principal");
    return;
  }

  messageQueue.process("SendMessage", handleSendMessage);

  scheduleMonitor.process("Verify", handleVerifySchedules);

  sendScheduledMessages.process("SendMessage", handleSendScheduledMessage);

  campaignQueue.process("VerifyCampaigns", handleVerifyCampaigns);

  campaignQueue.process("ProcessCampaign", handleProcessCampaign);

  campaignQueue.process("PrepareContact", handlePrepareContact);

  campaignQueue.process("DispatchCampaign", handleDispatchCampaign);

  userMonitor.process("VerifyLoginStatus", handleLoginStatus);

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
