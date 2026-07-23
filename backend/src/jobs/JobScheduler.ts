import { CronJob } from "cron";

import { appConfig } from "../config/AppConfig";
import { ticketSweepProcessor } from "./TicketSweepProcessor";

/**
 * Agendador explícito dos crons de varredura de tickets (antigo bootstrap por
 * side-effect no import de queues/ticketJobs.ts). `start()` é chamado no boot
 * (server.ts); mesmas expressões cron e mesmo guard de instância principal —
 * nas instâncias secundárias nada é agendado.
 *
 * (O cron de transferência de tickets do server.ts e o wiring das filas Bull
 * em startQueueProcess são bootstraps próprios, fora deste agendador —
 * mesmos donos de antes.)
 */
export class JobScheduler {
  public start(): void {
    if (!appConfig.server.isMainInstance) {
      return;
    }

    this.scheduleCloseTicketsAutomatic();

    this.scheduleAttachTickets();

    this.scheduleCreateTicketAutomatic();
  }

  private scheduleAttachTickets(): void {
    const job = new CronJob("*/10 * * * *", async () => {
      await ticketSweepProcessor.attachTicketsToUsers();
    });
    job.start();
  }

  private scheduleCloseTicketsAutomatic(): void {
    const job = new CronJob("*/3 * * * *", async () => {
      await ticketSweepProcessor.closeTicketsAutomatic();
    });
    job.start();
  }

  private scheduleCreateTicketAutomatic(): void {
    const job = new CronJob("*/10 * * * *", async () => {
      await ticketSweepProcessor.createTicketsAutomatic();
    });
    job.start();
  }
}

export const jobScheduler = new JobScheduler();
