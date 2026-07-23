import path from "path";

import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { MediaStorageService } from "../../shared/storage/MediaStorageService";
import { CreateQuickMessageDto } from "./dtos/CreateQuickMessageDto";
import { FindQuickMessagesFilters } from "./dtos/FindQuickMessagesFilters";
import {
  ListQuickMessagesFilters,
  ListQuickMessagesResult
} from "./dtos/ListQuickMessagesFilters";
import { UpdateQuickMessageDto } from "./dtos/UpdateQuickMessageDto";
import QuickMessage from "./models/QuickMessage";
import { QuickMessagesRepository } from "./QuickMessagesRepository";

/** Tamanho de página fixo da listagem (comportamento original do ListService). */
const LIST_PAGE_SIZE = 20;

/** Subpasta em `public/` onde as mídias deste domínio ficam (ver model getter). */
const MEDIA_SUBFOLDER = "quickMessage";

/**
 * Casos de uso do domínio QuickMessages (doc 04 §§2–3). Absorve os arquivos do
 * antigo `services/QuickMessageService/` (List/Create/Show/Update/Delete/Find;
 * o `FindAllService` era código morto — não tinha importadores — e foi
 * descartado). Eventos de domínio emitidos via RealtimeGateway.
 *
 * Códigos de erro "de não encontrado" foram PRESERVADOS como no legado, mesmo
 * inconsistentes (`ERR_NO_TICKETNOTE_FOUND` em show/update, resquício de
 * copy-paste do TicketNote), para não quebrar a tradução do frontend.
 */
export class QuickMessagesService {
  constructor(
    private readonly repository = new QuickMessagesRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway,
    private readonly mediaStorage = new MediaStorageService()
  ) {}

  public async list(
    filters: ListQuickMessagesFilters
  ): Promise<ListQuickMessagesResult> {
    const { companyId, userId, searchParam = "", pageNumber = "1" } = filters;
    const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { records, count } = await this.repository.findAndCountPaged({
      companyId,
      userId,
      searchParam: sanitizedSearchParam,
      limit,
      offset
    });

    const hasMore = count > offset + records.length;

    return { records, count, hasMore };
  }

  public async create(dto: CreateQuickMessageDto): Promise<QuickMessage> {
    const record = await this.repository.create(dto);

    this.emitQuickMessageEvent(dto.companyId, { action: "create", record });

    return record;
  }

  public async show(id: string | number): Promise<QuickMessage> {
    return this.findByIdOrFail(id, "ERR_NO_TICKETNOTE_FOUND");
  }

  public async update(
    id: string | number,
    dto: UpdateQuickMessageDto,
    companyId: number
  ): Promise<QuickMessage> {
    const record = await this.findByIdOrFail(id, "ERR_NO_TICKETNOTE_FOUND");
    const { shortcode, message, userId } = dto;

    const updated = await this.repository.update(record, {
      shortcode,
      message,
      userId
    });

    this.emitQuickMessageEvent(companyId, { action: "update", record: updated });

    return updated;
  }

  public async delete(id: string | number, companyId: number): Promise<void> {
    const record = await this.findByIdOrFail(id, "ERR_NO_QUICKMESSAGE_FOUND");

    await this.repository.delete(record);

    this.emitQuickMessageEvent(companyId, { action: "delete", id });
  }

  public async find(filters: FindQuickMessagesFilters): Promise<QuickMessage[]> {
    return this.repository.findAllByCompanyAndUser(filters);
  }

  public async attachMedia(
    id: string | number,
    file: Express.Multer.File,
    companyId: number
  ): Promise<QuickMessage> {
    const record = await this.findByIdOrFail(id, "ERR_NO_QUICKMESSAGE_FOUND");
    const storedFileName = this.mediaStorage.saveUpload(file, companyId);

    return this.repository.update(record, {
      mediaPath: storedFileName,
      mediaName: file.originalname
    });
  }

  public async removeMedia(id: string | number): Promise<QuickMessage> {
    const record = await this.findByIdOrFail(id, "ERR_NO_QUICKMESSAGE_FOUND");

    if (record.mediaName) {
      // Drift preservado: QuickMessage apaga por `mediaName` na subpasta
      // `quickMessage/` (os outros 5 controllers apagam por `mediaPath` na raiz).
      this.mediaStorage.deleteFile(path.join(MEDIA_SUBFOLDER, record.mediaName));
    }

    return this.repository.update(record, { mediaPath: null, mediaName: null });
  }

  private async findByIdOrFail(
    id: string | number,
    notFoundCode: string
  ): Promise<QuickMessage> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new AppError(notFoundCode, 404);
    }

    return record;
  }

  private emitQuickMessageEvent(companyId: number, payload: unknown): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyQuickMessage(companyId),
      payload
    );
  }
}
