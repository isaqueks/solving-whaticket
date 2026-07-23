import app from "./app";
import { appConfig } from "./config/AppConfig";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { whatsappSessionService } from "./modules/whatsapp-session/WhatsappSessionService";
import Company from "./modules/companies/models/Company";
import { startQueueProcess } from "./queues";
import { jobScheduler } from "./jobs/JobScheduler";
import { ticketTransferJob } from "./modules/whatsapp-session/TicketTransferJob";
import cron from "node-cron";

// Falha rápido no boot se faltar variável obrigatória (DB_*, REDIS_URI,
// CHECK_AUTH_ENDPOINT) — loga um fatal com a lista das ausentes e lança.
appConfig.validate("server");

// Crons de varredura de tickets (fechamento/vínculo/criação automáticos) —
// o próprio start() aplica o guard de instância principal, como o antigo
// bootstrap por side-effect em queues/ticketJobs.ts.
jobScheduler.start();

const server = app.listen(appConfig.server.port, async () => {
  if (appConfig.server.isMainInstance) {
    const companies = await Company.findAll();
    const allPromises: Promise<void>[] = [];
    companies.map(async c => {
      const promise = whatsappSessionService.startAll(c.id);
      allPromises.push(promise);
    });

    Promise.all(allPromises).then(() => {
      startQueueProcess();
    });
  }
  logger.info(`Server started on port: ${appConfig.server.port}`);
});

if (appConfig.server.isMainInstance) {
  cron.schedule("* * * * *", async () => {
    try {
      logger.info(`Serviço de transferencia de tickets iniciado`);

      await ticketTransferJob.execute();
    } catch (error) {
      logger.error(error);
    }
  });

  initIO(server);
}
