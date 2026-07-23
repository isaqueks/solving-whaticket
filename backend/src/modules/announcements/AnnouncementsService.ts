import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { MediaStorageService } from "../../shared/storage/MediaStorageService";
import { CreateAnnouncementDto } from "./dtos/CreateAnnouncementDto";
import { FindAnnouncementsFilters } from "./dtos/FindAnnouncementsFilters";
import {
  ListAnnouncementsFilters,
  ListAnnouncementsResult
} from "./dtos/ListAnnouncementsFilters";
import { UpdateAnnouncementDto } from "./dtos/UpdateAnnouncementDto";
import Announcement from "./models/Announcement";
import { AnnouncementsRepository } from "./AnnouncementsRepository";

/** Tamanho de página fixo da listagem (comportamento original do ListService). */
const LIST_PAGE_SIZE = 20;

/**
 * Casos de uso do domínio Announcements (doc 04 §§2–3). Absorve os arquivos do
 * antigo `services/AnnouncementService/` (List/Create/Show/Update/Delete/Find)
 * e os handlers `mediaUpload`/`deleteMedia` do controller. O `FindAllService`
 * era código morto — não tinha importadores — e foi descartado.
 *
 * Eventos de domínio emitidos via RealtimeGateway (nunca `io.to` direto). A
 * mídia é gravada pelo multer e removida via MediaStorageService, preservando
 * a convenção deste domínio (exclusão por `mediaPath` na raiz de `public/`).
 */
export class AnnouncementsService {
  constructor(
    private readonly repository = new AnnouncementsRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway,
    private readonly mediaStorage = new MediaStorageService()
  ) {}

  public async list(
    filters: ListAnnouncementsFilters
  ): Promise<ListAnnouncementsResult> {
    const { searchParam, pageNumber = "1" } = filters;
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { records, count } = await this.repository.findAndCountPaged({
      searchParam,
      limit,
      offset
    });

    const hasMore = count > offset + records.length;

    return { records, count, hasMore };
  }

  public async create(dto: CreateAnnouncementDto): Promise<Announcement> {
    // Validação de negócio preservada do CreateService (código de erro estável
    // ERR_ANNOUNCEMENT_REQUIRED, traduzido pelo frontend).
    if (!dto.title || !dto.text) {
      throw new AppError("ERR_ANNOUNCEMENT_REQUIRED");
    }

    const record = await this.repository.create(dto);

    this.emitAnnouncementEvent(dto.companyId, { action: "create", record });

    return record;
  }

  public async show(id: string | number): Promise<Announcement> {
    return this.findByIdOrFail(id);
  }

  public async update(
    id: string | number,
    dto: UpdateAnnouncementDto,
    companyId: number
  ): Promise<Announcement> {
    const record = await this.findByIdOrFail(id);
    const { priority, title, text, status } = dto;

    const updated = await this.repository.update(record, {
      priority,
      title,
      text,
      status
    });

    this.emitAnnouncementEvent(companyId, { action: "update", record: updated });

    return updated;
  }

  public async delete(id: string | number, companyId: number): Promise<void> {
    const record = await this.findByIdOrFail(id);

    await this.repository.delete(record);

    this.emitAnnouncementEvent(companyId, { action: "delete", id });
  }

  public async find(
    filters: FindAnnouncementsFilters
  ): Promise<Announcement[]> {
    return this.repository.findAllByCompany(filters.companyId);
  }

  public async attachMedia(
    id: string | number,
    file: Express.Multer.File,
    companyId: number
  ): Promise<Announcement> {
    const record = await this.findByIdOrFail(id);
    const storedFileName = this.mediaStorage.saveUpload(file, companyId);

    const updated = await this.repository.update(record, {
      mediaPath: storedFileName,
      mediaName: file.originalname
    });

    this.emitAnnouncementEvent(companyId, { action: "update", record: updated });

    return updated;
  }

  public async removeMedia(
    id: string | number,
    companyId: number
  ): Promise<Announcement> {
    const record = await this.findByIdOrFail(id);

    if (record.mediaPath) {
      // Drift preservado: Announcement apaga por `mediaPath` na raiz de
      // `public/` (o QuickMessage apaga por `mediaName` numa subpasta).
      this.mediaStorage.deleteFile(record.mediaPath);
    }

    const updated = await this.repository.update(record, {
      mediaPath: null,
      mediaName: null
    });

    this.emitAnnouncementEvent(companyId, { action: "update", record: updated });

    return updated;
  }

  private async findByIdOrFail(id: string | number): Promise<Announcement> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new AppError("ERR_NO_ANNOUNCEMENT_FOUND", 404);
    }

    return record;
  }

  private emitAnnouncementEvent(companyId: number, payload: unknown): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyAnnouncement(companyId),
      payload
    );
  }
}
