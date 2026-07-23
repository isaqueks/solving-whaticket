import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { UsersService } from "../users/UsersService";
import { CompaniesService } from "./CompaniesService";
import { CreateCompanyDto } from "./dtos/CreateCompanyDto";
import { UpdateCompanyDto } from "./dtos/UpdateCompanyDto";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
};

type SchedulesData = {
  schedules: [];
};

/** Contrato mínimo de schema Yup aceito pelo guard de validação. */
interface ValidatableSchema {
  validate(value: unknown): Promise<unknown>;
}

const NO_PERMISSION_MESSAGE =
  "Você não possui permissão para acessar este recurso!";

/**
 * Controller fino (doc 04 §3): parse da requisição, validação Yup no boundary,
 * permissão e status code — negócio fica no service. Handlers são arrow
 * properties (template B1), passados direto no arquivo de rotas.
 *
 * As rotas de gestão (list/index/store/update/remove) já têm guard `isSuper` no
 * middleware; `listPlan`/`indexPlan` têm permissão condicional (super OU dono da
 * empresa), resolvida aqui via `UsersService.isSuper` — o controller não toca o
 * model User diretamente.
 */
export class CompaniesController {
  constructor(
    private readonly service = new CompaniesService(),
    private readonly usersService = new UsersService()
  ) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam, pageNumber } = req.query as IndexQuery;

    const { companies, count, hasMore } = await this.service.list({
      searchParam,
      pageNumber
    });

    return res.json({ companies, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const dto = req.body as CreateCompanyDto;

    await this.validateSchema(
      Yup.object().shape({ name: Yup.string().required() }),
      dto
    );

    const company = await this.service.create(dto);

    return res.status(200).json(company);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;

    const company = await this.service.show(id);

    return res.status(200).json(company);
  };

  public list = async (req: Request, res: Response): Promise<Response> => {
    const companies = await this.service.findAll();

    return res.status(200).json(companies);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const dto = req.body as UpdateCompanyDto;

    await this.validateSchema(
      Yup.object().shape({ name: Yup.string() }),
      dto
    );

    const { id } = req.params;

    const company = await this.service.update(id, dto);

    return res.status(200).json(company);
  };

  public updateSchedules = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { schedules } = req.body as SchedulesData;
    const { id } = req.params;

    const company = await this.service.updateSchedules({ id, schedules });

    return res.status(200).json(company);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;

    await this.service.delete(id);

    return res.status(200).json();
  };

  public listPlan = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;

    const isSuper = await this.usersService.isSuper(req.user.id);

    if (!isSuper && req.user.companyId.toString() !== id) {
      return res.status(400).json({ error: NO_PERMISSION_MESSAGE });
    }

    const company = await this.service.showWithPlan(id);

    return res.status(200).json(company);
  };

  public indexPlan = async (req: Request, res: Response): Promise<Response> => {
    const isSuper = await this.usersService.isSuper(req.user.id);

    if (!isSuper) {
      return res.status(400).json({ error: NO_PERMISSION_MESSAGE });
    }

    const companies = await this.service.listWithPlans();

    return res.json({ companies });
  };

  /** Converte falha de validação Yup em AppError 400 (padrão original). */
  private async validateSchema(
    schema: ValidatableSchema,
    payload: unknown
  ): Promise<void> {
    try {
      await schema.validate(payload);
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : String(err));
    }
  }
}
