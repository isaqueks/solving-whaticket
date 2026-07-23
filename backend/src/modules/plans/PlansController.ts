import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { CreatePlanDto } from "./dtos/CreatePlanDto";
import { UpdatePlanDto } from "./dtos/UpdatePlanDto";
import { PlansService } from "./PlansService";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
};

/** Contrato mínimo de schema Yup aceito pelo guard de validação. */
interface ValidatableSchema {
  validate(value: unknown): Promise<unknown>;
}

/**
 * Controller fino (doc 04 §3): parse da requisição, validação Yup no boundary e
 * status code — negócio fica no service. Handlers são arrow properties (template
 * B1), então o arquivo de rotas passa o método direto, sem `.bind`.
 *
 * Permissão de super (POST/PUT/DELETE) fica no middleware `isSuper` das rotas,
 * idêntico ao antigo planRoutes.
 */
export class PlansController {
  constructor(private readonly service = new PlansService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam, pageNumber } = req.query as IndexQuery;

    const { plans, count, hasMore } = await this.service.list({
      searchParam,
      pageNumber
    });

    return res.json({ plans, count, hasMore });
  };

  public list = async (req: Request, res: Response): Promise<Response> => {
    const plans = await this.service.findAll();

    return res.status(200).json(plans);
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const dto = req.body as CreatePlanDto;

    await this.validateSchema(
      Yup.object().shape({ name: Yup.string().required() }),
      dto
    );

    const plan = await this.service.create(dto);

    return res.status(200).json(plan);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;

    const plan = await this.service.show(id);

    return res.status(200).json(plan);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const dto = req.body as UpdatePlanDto;

    await this.validateSchema(
      Yup.object().shape({ name: Yup.string() }),
      dto
    );

    const { id } = req.params;

    const plan = await this.service.update(id, dto);

    return res.status(200).json(plan);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;

    await this.service.delete(id);

    return res.status(200).json();
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
