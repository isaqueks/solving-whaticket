import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { MediaStorageService } from "../../shared/storage/MediaStorageService";
import { AttachMediasDto } from "./dtos/AttachMediasDto";
import { CreateFileListDto } from "./dtos/CreateFileListDto";
import { FileOptionInput } from "./dtos/FileOptionInput";
import { ListFilesFilters, ListFilesResult } from "./dtos/ListFilesFilters";
import { SimpleListFilesFilters } from "./dtos/SimpleListFilesFilters";
import { UpdateFileListDto } from "./dtos/UpdateFileListDto";
import Files from "./models/Files";
import { FilesRepository } from "./FilesRepository";

/** Tamanho de página fixo da listagem (comportamento original do ListService). */
const LIST_PAGE_SIZE = 20;

/**
 * Casos de uso do domínio Files (listas de arquivos — doc 04 §§2–3). Absorve os
 * arquivos do antigo `services/FileServices/` (List/SimpleList/Create/Show/
 * Update/Delete/DeleteAll) e o handler `uploadMedias` do controller.
 *
 * Eventos de domínio emitidos via RealtimeGateway (nunca `io.to` direto), com o
 * nome canônico `SocketEvents.companyFile`. A mídia é gravada pelo multer (em
 * `public/fileList/<fileId>/`, via `config/upload.ts`) e o nome persistido é
 * obtido pelo MediaStorageService, preservando a convenção de pasta por lista.
 */
export class FilesService {
  constructor(
    private readonly repository = new FilesRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway,
    private readonly mediaStorage = new MediaStorageService()
  ) {}

  public async list(filters: ListFilesFilters): Promise<ListFilesResult> {
    const { companyId, searchParam, pageNumber = "1" } = filters;
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { records, count } = await this.repository.findAndCountPaged({
      companyId,
      searchParam,
      limit,
      offset
    });

    const hasMore = count > offset + records.length;

    return { files: records, count, hasMore };
  }

  public async simpleList(filters: SimpleListFilesFilters): Promise<Files[]> {
    return this.repository.findAllByCompany(
      filters.companyId,
      filters.searchParam
    );
  }

  public async create(dto: CreateFileListDto): Promise<Files> {
    const { name, message, companyId, options } = dto;

    // Regra de negócio preservada do CreateService (código de erro estável
    // ERR_RATING_NAME_ALREADY_EXISTS, traduzido pelo frontend).
    if (await this.repository.existsByName(name, companyId)) {
      throw new AppError("ERR_RATING_NAME_ALREADY_EXISTS");
    }

    const created = await this.repository.create({ name, message, companyId });

    await this.upsertOptions(created.id, options);

    const fileList = await this.findByIdOrFail(created.id, companyId);

    this.emitFileEvent(companyId, { action: "create", fileList });

    return fileList;
  }

  public async show(id: string | number, companyId: number): Promise<Files> {
    return this.findByIdOrFail(id, companyId);
  }

  public async update(
    id: string | number,
    dto: UpdateFileListDto,
    companyId: number
  ): Promise<Files> {
    const file = await this.findByIdOrFail(id, companyId);
    const { name, message, options } = dto;

    if (options) {
      await this.upsertOptions(file.id, options);
      await this.removeMissingOptions(file, options);
    }

    const fileList = await this.repository.update(file, { name, message });

    this.emitFileEvent(companyId, { action: "update", fileList });

    return fileList;
  }

  public async delete(id: string | number, companyId: number): Promise<void> {
    const file = await this.repository.findByIdWithOptions(id, companyId);
    if (!file) {
      // Código de erro estável preservado do DeleteService (difere do
      // ERR_NO_FILE_FOUND do show — o frontend traduz ambos).
      throw new AppError("ERR_NO_RATING_FOUND", 404);
    }

    await this.repository.delete(file);

    this.emitFileEvent(companyId, { action: "delete", fileId: id });
  }

  public async deleteAll(companyId: number): Promise<void> {
    // Correção aprovada de multi-tenancy: apaga apenas as listas da empresa
    // (o DeleteAllService original ignorava a empresa). Nenhum evento é emitido.
    await this.repository.deleteAll(companyId);
  }

  public async attachMedias(dto: AttachMediasDto): Promise<void> {
    const { fileId, optionIds, mediaTypes, files, companyId } = dto;

    if (files.length === 0) {
      return;
    }

    for (const [index, file] of files.entries()) {
      const optionId = Array.isArray(optionIds) ? optionIds[index] : optionIds;
      const mediaType = Array.isArray(mediaTypes)
        ? mediaTypes[index]
        : mediaTypes;

      const option = await this.repository.findOption(fileId, optionId);
      if (!option) {
        throw new AppError("ERR_NO_FILE_FOUND", 404);
      }

      // O multer já gravou o arquivo em `public/fileList/<fileId>/`; o
      // MediaStorageService devolve o nome persistido e o domínio guarda o
      // basename (drift preservado do handler original: `.replace('/','-')`).
      const storedFileName = this.mediaStorage
        .saveUpload(file, companyId)
        .replace("/", "-");

      await this.repository.updateOption(option, {
        path: storedFileName,
        mediaType
      });
    }
  }

  private async upsertOptions(
    fileId: number,
    options?: FileOptionInput[]
  ): Promise<void> {
    if (!options || options.length === 0) {
      return;
    }

    for (const option of options) {
      await this.repository.upsertOption(fileId, option);
    }
  }

  private async removeMissingOptions(
    file: Files,
    options: FileOptionInput[]
  ): Promise<void> {
    for (const oldInfo of file.options) {
      const stillExists = options.some(info => info.id === oldInfo.id);

      if (!stillExists) {
        await this.repository.destroyOption(oldInfo.id);
      }
    }
  }

  private async findByIdOrFail(
    id: string | number,
    companyId: number
  ): Promise<Files> {
    const file = await this.repository.findByIdWithOptions(id, companyId);
    if (!file) {
      throw new AppError("ERR_NO_FILE_FOUND", 404);
    }

    return file;
  }

  private emitFileEvent(companyId: number, payload: unknown): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyFile(companyId),
      payload
    );
  }
}
