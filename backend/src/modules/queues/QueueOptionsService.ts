import AppError from "../../shared/errors/AppError";
import { MediaStorageService } from "../../shared/storage/MediaStorageService";
import { CreateQueueOptionDto } from "./dtos/CreateQueueOptionDto";
import { ListQueueOptionsFilters } from "./dtos/ListQueueOptionsFilters";
import { UpdateQueueOptionDto } from "./dtos/UpdateQueueOptionDto";
import QueueOption from "./models/QueueOption";
import { QueueOptionsRepository } from "./QueueOptionsRepository";

/**
 * Casos de uso do domínio QueueOptions (nós do chatbot de cada fila) — doc 04
 * §§2–3. Absorve os 5 arquivos do antigo `services/QueueOptionService/`. Não há
 * emissão de socket neste domínio (o QueueOptionController legado não emitia),
 * então o service não depende do RealtimeGateway.
 */
export class QueueOptionsService {
  constructor(
    private readonly repository = new QueueOptionsRepository(),
    private readonly mediaStorage = new MediaStorageService()
  ) {}

  public async list(
    filters: ListQueueOptionsFilters
  ): Promise<QueueOption[]> {
    return this.repository.findAllFiltered(filters);
  }

  public async create(dto: CreateQueueOptionDto): Promise<QueueOption> {
    return this.repository.create(dto);
  }

  public async show(id: string | number): Promise<QueueOption> {
    return this.findByIdOrFail(id);
  }

  public async update(
    id: string | number,
    dto: UpdateQueueOptionDto
  ): Promise<QueueOption> {
    const queueOption = await this.findByIdOrFail(id);

    return this.repository.update(queueOption, dto);
  }

  public async delete(id: string | number): Promise<void> {
    const queueOption = await this.findByIdOrFail(id);

    await this.repository.delete(queueOption);
  }

  public async attachMedia(
    id: string | number,
    file: Express.Multer.File,
    companyId: number
  ): Promise<QueueOption> {
    const queueOption = await this.findByIdOrFail(id);
    const storedFileName = this.mediaStorage.saveUpload(file, companyId);

    return this.repository.update(queueOption, {
      mediaPath: storedFileName,
      mediaName: file.originalname
    });
  }

  public async removeMedia(id: string | number): Promise<QueueOption> {
    const queueOption = await this.findByIdOrFail(id);

    if (queueOption.mediaPath) {
      // Convenção de EXCLUSÃO preservada (drift, ver MediaStorageService):
      // QueueOption apaga por `mediaPath` na raiz de `public/`.
      this.mediaStorage.deleteFile(queueOption.mediaPath);
    }

    return this.repository.update(queueOption, {
      mediaPath: null,
      mediaName: null
    });
  }

  private async findByIdOrFail(id: string | number): Promise<QueueOption> {
    const queueOption = await this.repository.findByIdWithParent(id);
    if (!queueOption) {
      throw new AppError("ERR_QUEUE_NOT_FOUND");
    }

    return queueOption;
  }
}
