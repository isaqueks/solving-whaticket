import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { MediaStorageService } from "../../shared/storage/MediaStorageService";
import { CreateQueueDto } from "./dtos/CreateQueueDto";
import { ListQueuesFilters } from "./dtos/ListQueuesFilters";
import { UpdateQueueDto } from "./dtos/UpdateQueueDto";
import Queue from "./models/Queue";
import { QueuesRepository } from "./QueuesRepository";

/** Formato de cor aceito (mesmo regex do CreateQueueService/UpdateQueueService). */
const COLOR_REGEX = /^#[0-9a-f]{3,6}$/i;

/**
 * Casos de uso do domínio Queues (setores de atendimento) — doc 04 §§2–3.
 * Absorve os 5 arquivos do antigo `services/QueueService/`. Regras de negócio
 * (limite por plano, unicidade de nome/cor, escopo de empresa) preservadas com
 * os MESMOS códigos de erro; eventos de domínio via RealtimeGateway.
 */
export class QueuesService {
  constructor(
    private readonly repository = new QueuesRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway,
    private readonly mediaStorage = new MediaStorageService()
  ) {}

  public async list(filters: ListQueuesFilters): Promise<Queue[]> {
    return this.repository.findAllByCompany(filters.companyId);
  }

  public async create(dto: CreateQueueDto): Promise<Queue> {
    await this.ensureWithinPlanLimit(dto.companyId);
    await this.validateName(dto.name, dto.companyId, { required: true });
    await this.validateColor(dto.color, dto.companyId);

    const queue = await this.repository.create(dto);

    this.emitQueueEvent(dto.companyId, { action: "create", queue });

    return queue;
  }

  public async show(id: string | number, companyId: number): Promise<Queue> {
    const queue = await this.repository.findById(id);

    // Comportamento legado preservado (ShowQueueService): a checagem de empresa
    // roda ANTES do null-check, então uma fila inexistente também cai aqui — o
    // ramo ERR_QUEUE_NOT_FOUND do serviço original era inalcançável.
    if (queue?.companyId !== companyId) {
      throw new AppError("Não é possível consultar registros de outra empresa");
    }

    return queue;
  }

  public async update(
    id: string | number,
    dto: UpdateQueueDto,
    companyId: number
  ): Promise<Queue> {
    // Ordem preservada do UpdateQueueService: valida ANTES de carregar a fila.
    await this.validateName(dto.name, companyId, { required: false, excludeId: id });
    await this.validateColor(dto.color, companyId, id);

    const queue = await this.show(id, companyId);

    const updated = await this.repository.update(queue, dto);

    this.emitQueueEvent(companyId, { action: "update", queue: updated });

    return updated;
  }

  public async delete(id: string | number, companyId: number): Promise<void> {
    const queue = await this.show(id, companyId);

    await this.repository.delete(queue);

    this.emitQueueEvent(companyId, { action: "delete", queueId: Number(id) });
  }

  public async attachMedia(
    id: string | number,
    file: Express.Multer.File,
    companyId: number
  ): Promise<Queue> {
    const queue = await this.findByIdOrFail(id);
    const storedFileName = this.mediaStorage.saveUpload(file, companyId);

    return this.repository.update(queue, {
      mediaPath: storedFileName,
      mediaName: file.originalname
    });
  }

  public async removeMedia(id: string | number): Promise<Queue> {
    const queue = await this.findByIdOrFail(id);

    if (queue.mediaPath) {
      // Convenção de EXCLUSÃO preservada (drift, ver MediaStorageService):
      // Queue apaga por `mediaPath` na raiz de `public/`.
      this.mediaStorage.deleteFile(queue.mediaPath);
    }

    return this.repository.update(queue, { mediaPath: null, mediaName: null });
  }

  private async findByIdOrFail(id: string | number): Promise<Queue> {
    const queue = await this.repository.findById(id);
    if (!queue) {
      throw new AppError("ERR_QUEUE_NOT_FOUND");
    }

    return queue;
  }

  /** Limite de filas por plano (comportamento do CreateQueueService). */
  private async ensureWithinPlanLimit(companyId: number): Promise<void> {
    const company = await this.repository.findCompanyWithPlan(companyId);
    if (company === null) {
      return;
    }

    const queuesCount = await this.repository.countByCompany(companyId);
    if (queuesCount >= company.plan.queues) {
      throw new AppError(`Número máximo de filas já alcançado: ${queuesCount}`);
    }
  }

  private async validateName(
    name: string | undefined,
    companyId: number,
    opts: { required: boolean; excludeId?: string | number }
  ): Promise<void> {
    // Update: nome é opcional (só valida quando informado, como o custom test
    // `if (value)` do UpdateQueueService). Create: nome é obrigatório.
    if (!name) {
      if (opts.required) {
        throw new AppError("ERR_QUEUE_INVALID_NAME");
      }
      return;
    }

    if (name.length < 2) {
      throw new AppError("ERR_QUEUE_INVALID_NAME");
    }

    const existing = await this.repository.findByNameInCompany(
      name,
      companyId,
      opts.excludeId
    );
    if (existing) {
      throw new AppError("ERR_QUEUE_NAME_ALREADY_EXISTS");
    }
  }

  /** Cor é obrigatória tanto no create quanto no update (regra do legado). */
  private async validateColor(
    color: string | undefined,
    companyId: number,
    excludeId?: string | number
  ): Promise<void> {
    if (!color || !COLOR_REGEX.test(color)) {
      throw new AppError("ERR_QUEUE_INVALID_COLOR");
    }

    const existing = await this.repository.findByColorInCompany(
      color,
      companyId,
      excludeId
    );
    if (existing) {
      throw new AppError("ERR_QUEUE_COLOR_ALREADY_EXISTS");
    }
  }

  private emitQueueEvent(companyId: number, payload: unknown): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyQueue(companyId),
      payload
    );
  }
}
