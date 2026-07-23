import fs from "fs";
import path from "path";

import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { CreateScheduleDto } from "./dtos/CreateScheduleDto";
import {
  ListSchedulesFilters,
  ListSchedulesResult
} from "./dtos/ListSchedulesFilters";
import { UpdateScheduleDto } from "./dtos/UpdateScheduleDto";
import Schedule from "./models/Schedule";
import { SchedulesRepository } from "./SchedulesRepository";

/** Página fixa da listagem (comportamento original do ListService). */
const LIST_PAGE_SIZE = 20;

/** Status inicial de um agendamento recém-criado (CreateService original). */
const INITIAL_STATUS = "PENDENTE";

/**
 * Casos de uso do domínio Schedules (doc 04 §§2–3). Absorve os 5 arquivos do
 * antigo `services/ScheduleServices/` e as rotinas de mídia do controller.
 * Regras de negócio preservadas; eventos de domínio emitidos via
 * RealtimeGateway (nunca `io.to` direto).
 */
export class SchedulesService {
  constructor(
    private readonly repository = new SchedulesRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async create(dto: CreateScheduleDto): Promise<Schedule> {
    const { body, sendAt, contactId, companyId, userId } = dto;

    const schedule = await this.repository.create({
      body,
      sendAt,
      contactId,
      companyId,
      userId,
      status: INITIAL_STATUS
    });

    this.emitScheduleEvent(Number(companyId), { action: "create", schedule });

    return schedule;
  }

  public async update(
    id: string | number,
    dto: UpdateScheduleDto,
    companyId: number
  ): Promise<Schedule> {
    const schedule = await this.show(id, companyId);

    const { body, sendAt, sentAt, contactId, ticketId, userId } = dto;
    const updated = await this.repository.update(schedule, {
      body,
      sendAt,
      sentAt,
      contactId,
      ticketId,
      userId
    });

    this.emitScheduleEvent(companyId, { action: "update", schedule: updated });

    return updated;
  }

  public async delete(id: string | number, companyId: number): Promise<void> {
    const schedule = await this.repository.findByIdAndCompany(id, companyId);
    if (!schedule) {
      throw new AppError("ERR_NO_SCHEDULE_FOUND", 404);
    }

    await this.repository.delete(schedule);

    this.emitScheduleEvent(companyId, { action: "delete", scheduleId: id });
  }

  public async show(id: string | number, companyId: number): Promise<Schedule> {
    const schedule = await this.repository.findByIdWithRelations(id);

    // Ordem preservada do ShowService original: a checagem de empresa vem
    // antes do null-check, então um id inexistente cai neste primeiro throw.
    if (schedule?.companyId !== companyId) {
      throw new AppError("Não é possível excluir registro de outra empresa");
    }
    if (!schedule) {
      throw new AppError("ERR_NO_SCHEDULE_FOUND", 404);
    }

    return schedule;
  }

  public async list(
    filters: ListSchedulesFilters
  ): Promise<ListSchedulesResult> {
    const {
      companyId,
      searchParam,
      contactId,
      userId,
      pageNumber = "1"
    } = filters;
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { schedules, count } = await this.repository.findAndCountAll({
      companyId,
      searchParam,
      contactId,
      userId,
      limit,
      offset
    });

    const hasMore = count > offset + schedules.length;

    return { schedules, count, hasMore };
  }

  // TODO(B2-fase2): usar shared/storage/MediaStorageService (unificação dos 6
  // mediaUpload/deleteMedia duplicados dos controllers). Mantido como método
  // do próprio módulo por ora — comportamento idêntico ao controller original.
  public async uploadMedia(
    id: string | number,
    file: Express.Multer.File
  ): Promise<void> {
    try {
      const schedule = await this.repository.findById(id);
      schedule.mediaPath = file.filename;
      schedule.mediaName = file.originalname;

      await this.repository.save(schedule);
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : String(err));
    }
  }

  // TODO(B2-fase2): usar shared/storage/MediaStorageService (unificação dos 6
  // mediaUpload/deleteMedia duplicados dos controllers). Mantido como método
  // do próprio módulo por ora — comportamento idêntico ao controller original.
  public async deleteMedia(id: string | number): Promise<void> {
    try {
      const schedule = await this.repository.findById(id);
      const filePath = path.resolve("public", schedule.mediaPath);
      const fileExists = fs.existsSync(filePath);
      if (fileExists) {
        fs.unlinkSync(filePath);
      }

      schedule.mediaPath = null;
      schedule.mediaName = null;
      await this.repository.save(schedule);
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : String(err));
    }
  }

  private emitScheduleEvent(companyId: number, payload: unknown): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companySchedule(companyId),
      payload
    );
  }
}
