import BullQueue from "bull";

const connection = process.env.REDIS_URI || "";
const limiterMax = process.env.REDIS_OPT_LIMITER_MAX || 1;
const limiterDuration = process.env.REDIS_OPT_LIMITER_DURATION || 3000;

export const userMonitor = new BullQueue("UserMonitor", connection);

export const messageQueue = new BullQueue("MessageQueue", connection, {
  limiter: {
    max: limiterMax as number,
    duration: limiterDuration as number
  }
});

export const scheduleMonitor = new BullQueue("ScheduleMonitor", connection);
export const sendScheduledMessages = new BullQueue(
  "SendSacheduledMessages",
  connection
);

export const campaignQueue = new BullQueue("CampaignQueue", connection);
