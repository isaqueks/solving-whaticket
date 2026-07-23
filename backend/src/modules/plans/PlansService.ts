import AppError from "../../shared/errors/AppError";
import { CreatePlanDto } from "./dtos/CreatePlanDto";
import { ListPlansFilters, ListPlansResult } from "./dtos/ListPlansFilters";
import { UpdatePlanDto } from "./dtos/UpdatePlanDto";
import Plan from "./models/Plan";
import { PlansRepository } from "./PlansRepository";

/** Tamanho de página fixo da listagem (comportamento original do ListPlansService). */
const LIST_PAGE_SIZE = 20;

/** Comprimento mínimo do nome (regra original do CreatePlanService — Yup min 2). */
const MIN_NAME_LENGTH = 2;

/**
 * Casos de uso do domínio Plans (doc 04 §§2–3). Absorve os 6 serviços do antigo
 * `services/PlanService/`. O domínio não tem realtime: o único evento "plan"
 * existia apenas em código comentado no antigo PlanController e o frontend não
 * possui listener — decisão B3: migrar sem realtime (ver events.ts).
 */
export class PlansService {
  constructor(private readonly repository = new PlansRepository()) {}

  public async list(filters: ListPlansFilters): Promise<ListPlansResult> {
    const { searchParam = "", pageNumber = "1" } = filters;
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { plans, count } = await this.repository.findAndCountPaged({
      searchParam,
      limit,
      offset
    });

    const hasMore = count > offset + plans.length;

    return { plans, count, hasMore };
  }

  /** Todos os planos ordenados por nome (rotas públicas /plans/list e /plans/all). */
  public async findAll(): Promise<Plan[]> {
    return this.repository.findAllOrderedByName();
  }

  public async create(dto: CreatePlanDto): Promise<Plan> {
    await this.ensureNameValid(dto.name);

    return this.repository.create(dto);
  }

  public async show(id: string | number): Promise<Plan> {
    const plan = await this.repository.findById(id);
    if (!plan) {
      throw new AppError("ERR_NO_PLAN_FOUND", 404);
    }

    return plan;
  }

  public async update(id: string | number, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.show(id);

    return this.repository.update(plan, dto);
  }

  public async delete(id: string | number): Promise<void> {
    const plan = await this.repository.findById(id);
    if (!plan) {
      throw new AppError("ERR_NO_PLAN_FOUND", 404);
    }

    await this.repository.delete(plan);
  }

  /**
   * Regras do antigo Yup do CreatePlanService: nome obrigatório, mínimo 2
   * caracteres e único. Códigos de erro preservados (o frontend traduz).
   */
  private async ensureNameValid(name?: string): Promise<void> {
    if (!name || name.length < MIN_NAME_LENGTH) {
      throw new AppError("ERR_PLAN_INVALID_NAME");
    }

    const existing = await this.repository.findByName(name);
    if (existing) {
      throw new AppError("ERR_PLAN_NAME_ALREADY_EXISTS");
    }
  }
}
