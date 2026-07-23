import * as Sentry from "@sentry/node";
import { Job } from "bull";
import moment from "moment";
import path from "path";

import formatBody from "../shared/helpers/Mustache";
import Schedule from "../modules/schedules/models/Schedule";
import { SchedulesRepository } from "../modules/schedules/SchedulesRepository";
import { whatsappMessageSender } from "../modules/whatsapp-session/WhatsappMessageSender";
import { whatsappService } from "../modules/whatsapp/WhatsappService";
import { logger } from "../utils/logger";
import { sendScheduledMessages } from "../queues/connection";

/**
 * Processors do ScheduleMonitor/SendSacheduledMessages (antigo
 * queues/scheduleJobs.ts) — comportamento preservado; acesso ao model via
 * SchedulesRepository.
 */
export class ScheduleProcessor {
  constructor(
    private readonly schedulesRepository = new SchedulesRepository()
  ) {}

  /** Job "Verify": promove agendamentos vencidos para a fila de envio. */
  public verifySchedules = async (job: Job): Promise<void> => {
    try {
      const { count, schedules } =
        await this.schedulesRepository.findAndCountPendingDue();
      if (count === 0) {
        return;
      }
      // Disparo em paralelo SEM await (fire-and-forget), como no original —
      // o handler retorna antes das promessas resolverem, de propósito.
      schedules.map(async schedule => {
        await this.schedulesRepository.updateForDispatch(schedule, {
          status: "AGENDADA"
        });
        sendScheduledMessages.add(
          "SendMessage",
          { schedule },
          { delay: 40000 }
        );
        logger.info(`Disparo agendado para: ${schedule.contact.name}`);
      });
    } catch (e) {
      Sentry.captureException(e);
      logger.error(
        "SendScheduledMessage -> Verify: error",
        (e as Error).message
      );
      throw e;
    }
  };

  /** Job "SendMessage": envia a mensagem agendada pela conexão padrão. */
  public sendScheduledMessage = async (job: Job): Promise<void> => {
    const {
      data: { schedule }
    } = job;
    let scheduleRecord: Schedule | null = null;

    try {
      scheduleRecord = await this.schedulesRepository.findById(schedule.id);
    } catch (e) {
      Sentry.captureException(e);
      logger.info(`Erro ao tentar consultar agendamento: ${schedule.id}`);
    }

    try {
      const whatsapp = await whatsappService.getDefaultWhatsApp(
        schedule.companyId
      );

      let filePath = null;
      if (schedule.mediaPath) {
        filePath = path.resolve("public", schedule.mediaPath);
      }

      await whatsappMessageSender.sendRaw(whatsapp, {
        number: schedule.contact.number,
        body: formatBody(schedule.body, schedule.contact),
        mediaPath: filePath
      });

      if (scheduleRecord) {
        await this.schedulesRepository.updateForDispatch(scheduleRecord, {
          sentAt: moment().format("YYYY-MM-DD HH:mm"),
          status: "ENVIADA"
        });
      }

      logger.info(`Mensagem agendada enviada para: ${schedule.contact.name}`);
      sendScheduledMessages.clean(15000, "completed");
    } catch (e) {
      Sentry.captureException(e);
      if (scheduleRecord) {
        await this.schedulesRepository.updateForDispatch(scheduleRecord, {
          status: "ERRO"
        });
      }
      logger.error(
        "SendScheduledMessage -> SendMessage: error",
        (e as Error).message
      );
      throw e;
    }
  };
}

export const scheduleProcessor = new ScheduleProcessor();
