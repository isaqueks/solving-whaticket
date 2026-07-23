export {
  campaignQueue,
  messageQueue,
  scheduleMonitor,
  sendScheduledMessages,
  userMonitor
} from "./queues/connection";
export { parseToMilliseconds, randomValue } from "./queues/lib";
export { startQueueProcess } from "./queues/startQueueProcess";

// Side-effect import: starts the CronJob-based ticket sweeps (auto-close,
// attach-to-user, auto-create) on the main instance at module load, exactly
// as the old monolithic queues.ts did.
import "./queues/ticketJobs";
