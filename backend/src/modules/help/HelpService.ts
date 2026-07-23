import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { CreateHelpDto } from "./dtos/CreateHelpDto";
import { ListHelpsFilters, ListHelpsResult } from "./dtos/ListHelpsFilters";
import { UpdateHelpDto } from "./dtos/UpdateHelpDto";
import { HelpRepository } from "./HelpRepository";
import Help from "./models/Help";

/** Página fixa da listagem (comportamento original do ListService). */
const LIST_PAGE_SIZE = 20;

/**
 * Casos de uso do domínio Help (doc 04 §§2–3). Absorve os 7 arquivos do
 * antigo `services/HelpServices/` (FindService/FindAllService, duplicados,
 * viram um único caso de uso). Regras de negócio preservadas; eventos de
 * domínio emitidos via RealtimeGateway (nunca `io.to` direto).
 *
 * `companyId` entra em create/update/delete apenas para escopar o evento de
 * realtime ao canal da empresa do usuário — Help em si é global (sem coluna
 * companyId), como no controller original.
 */
export class HelpService {
  constructor(
    private readonly repository = new HelpRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async create(dto: CreateHelpDto, companyId: number): Promise<Help> {
    const record = await this.repository.create(dto);

    this.emitHelpEvent(companyId, { action: "create", record });

    return record;
  }

  public async update(
    id: string | number,
    dto: UpdateHelpDto,
    companyId: number
  ): Promise<Help> {
    const record = await this.show(id);

    const updated = await this.repository.update(record, dto);

    this.emitHelpEvent(companyId, { action: "update", record: updated });

    return updated;
  }

  public async delete(id: string | number, companyId: number): Promise<void> {
    const record = await this.show(id);

    await this.repository.delete(record);

    this.emitHelpEvent(companyId, { action: "delete", id });
  }

  public async show(id: string | number): Promise<Help> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new AppError("ERR_NO_HELP_FOUND", 404);
    }

    return record;
  }

  public async list(filters: ListHelpsFilters): Promise<ListHelpsResult> {
    const { searchParam, pageNumber = "1" } = filters;
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { records, count } = await this.repository.findAndCountBySearch({
      searchParam,
      limit,
      offset
    });

    const hasMore = count > offset + records.length;

    return { records, count, hasMore };
  }

  public async findList(): Promise<Help[]> {
    return this.repository.findAllOrderedByTitle();
  }

  private emitHelpEvent(companyId: number, payload: unknown): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyHelp(companyId),
      payload
    );
  }
}
