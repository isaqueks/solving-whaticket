import BullQueue from "bull";

import { appConfig } from "../config/AppConfig";

const connection = appConfig.redis.uri;

export const userMonitor = new BullQueue("UserMonitor", connection);

export const messageQueue = new BullQueue("MessageQueue", connection, {
  limiter: {
    max: appConfig.redis.limiterMax,
    duration: appConfig.redis.limiterDuration
  }
});

export const scheduleMonitor = new BullQueue("ScheduleMonitor", connection);
export const sendScheduledMessages = new BullQueue(
  "SendSacheduledMessages",
  connection
);

export const campaignQueue = new BullQueue("CampaignQueue", connection);
