import { randomBytes } from "crypto";

import AppError from "../../shared/errors/AppError";
import {
  CompaniesRepository,
  CurrentSchedule
} from "./CompaniesRepository";
import { CreateCompanyDto } from "./dtos/CreateCompanyDto";
import {
  ListCompaniesFilters,
  ListCompaniesResult
} from "./dtos/ListCompaniesFilters";
import { UpdateCompanyDto } from "./dtos/UpdateCompanyDto";
import { UpdateSchedulesDto } from "./dtos/UpdateSchedulesDto";
import Company from "./models/Company";

/** Tamanho de página fixo da listagem (comportamento original do ListCompaniesService). */
const LIST_PAGE_SIZE = 20;

/** Comprimento mínimo do nome (regra original do CreateCompanyService — Yup min 2). */
const MIN_NAME_LENGTH = 2;

/**
 * Casos de uso do domínio Companies (doc 04 §§2–3). Absorve os 10 serviços do
 * antigo `services/CompanyService/` (incl. VerifyCurrentSchedule). O domínio não
 * tem realtime — o antigo CompanyController nunca emitia eventos.
 *
 * `create` preserva o onboarding original: cria a empresa, cria o usuário admin
 * (senha aleatória quando ausente) e semeia as Settings padrão. NÃO há transação
 * (follow-up documentado — fora do escopo desta fase).
 */
export class CompaniesService {
  constructor(private readonly repository = new CompaniesRepository()) {}

  public async list(
    filters: ListCompaniesFilters
  ): Promise<ListCompaniesResult> {
    const { searchParam = "", pageNumber = "1" } = filters;
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { companies, count } = await this.repository.findAndCountPaged({
      searchParam,
      limit,
      offset
    });

    const hasMore = count > offset + companies.length;

    return { companies, count, hasMore };
  }

  /** Todas as empresas com plano (resumido) e settings (grid de gestão). */
  public async findAll(): Promise<Company[]> {
    return this.repository.findAllWithPlanAndSettings();
  }

  public async create(dto: CreateCompanyDto): Promise<Company> {
    await this.ensureNameValid(dto.name);

    const { name, phone, email, status, planId, dueDate, recurrence } = dto;

    const company = await this.repository.create({
      name,
      phone,
      email,
      status,
      planId,
      dueDate,
      recurrence
    });

    await this.repository.createAdminUser({
      name: company.name,
      email: company.email,
      password: dto.password || randomBytes(16).toString("hex"),
      companyId: company.id
    });

    await this.repository.seedDefaultSettings(company.id);

    if (dto.campaignsEnabled !== undefined) {
      await this.repository.upsertCampaignsEnabledSetting(
        company.id,
        dto.campaignsEnabled
      );
    }

    return company;
  }

  public async show(id: string | number): Promise<Company> {
    const company = await this.repository.findById(id);
    if (!company) {
      throw new AppError("ERR_NO_COMPANY_FOUND", 404);
    }

    return company;
  }

  public async update(
    id: string | number,
    dto: UpdateCompanyDto
  ): Promise<Company> {
    const company = await this.show(id);

    const { name, phone, email, status, planId, dueDate, recurrence } = dto;

    await this.repository.update(company, {
      name,
      phone,
      email,
      status,
      planId,
      dueDate,
      recurrence
    });

    if (dto.campaignsEnabled !== undefined) {
      await this.repository.upsertCampaignsEnabledSetting(
        company.id,
        dto.campaignsEnabled
      );
    }

    return company;
  }

  public async updateSchedules(dto: UpdateSchedulesDto): Promise<Company> {
    const company = await this.show(dto.id);

    return this.repository.updateSchedules(company, dto.schedules);
  }

  public async delete(id: string | number): Promise<void> {
    const company = await this.repository.findById(id);
    if (!company) {
      throw new AppError("ERR_NO_COMPANY_FOUND", 404);
    }

    await this.repository.delete(company);
  }

  /**
   * Empresa com o plano completo (rota /companies/listPlan/:id). Sem guard de
   * "não encontrada" — preserva o antigo ShowPlanCompanyService, que retornava
   * `null` silenciosamente.
   */
  public async showWithPlan(id: string | number): Promise<Company | null> {
    return this.repository.findByIdWithPlan(id);
  }

  /** Empresas com o plano completo (rota /companiesPlan, apenas super). */
  public async listWithPlans(): Promise<Company[]> {
    return this.repository.findAllWithPlans();
  }

  /** Expediente atual da empresa (consumido pelo MessageListener do wbot). */
  public async verifyCurrentSchedule(
    id: string | number
  ): Promise<CurrentSchedule> {
    return this.repository.verifyCurrentSchedule(id);
  }

  /**
   * Regras do antigo Yup do CreateCompanyService: nome obrigatório, mínimo 2
   * caracteres e único. Códigos de erro preservados (o frontend traduz).
   */
  private async ensureNameValid(name?: string): Promise<void> {
    if (!name || name.length < MIN_NAME_LENGTH) {
      throw new AppError("ERR_COMPANY_INVALID_NAME");
    }

    const existing = await this.repository.findByName(name);
    if (existing) {
      throw new AppError("ERR_COMPANY_NAME_ALREADY_EXISTS");
    }
  }
}
