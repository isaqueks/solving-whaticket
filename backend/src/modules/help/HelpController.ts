import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { CreateHelpDto } from "./dtos/CreateHelpDto";
import { UpdateHelpDto } from "./dtos/UpdateHelpDto";
import { HelpService } from "./HelpService";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
};

/** Contrato mínimo de schema Yup aceito pelo guard de validação. */
interface ValidatableSchema {
  validate(value: unknown): Promise<unknown>;
}

/**
 * Controller fino (doc 04 §3): parse da requisição, validação Yup no
 * boundary e status code — negócio fica no service. A permissão de
 * super-usuário (store/update/remove) segue no middleware `isSuper` das
 * rotas, como no `routes/helpRoutes.ts` original.
 *
 * Convenção do template (B1): handlers são ARROW PROPERTIES da classe —
 * `this` já fica preso à instância, dispensando `.bind` no arquivo de rotas.
 */
export class HelpController {
  constructor(private readonly service = new HelpService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam, pageNumber } = req.query as IndexQuery;

    const { records, count, hasMore } = await this.service.list({
      searchParam,
      pageNumber
    });

    return res.json({ records, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { title, description, video, link } = req.body as CreateHelpDto;
    const { companyId } = req.user;

    await this.validateSchema(
      Yup.object().shape({
        title: Yup.string().required().min(3, "ERR_HELP_INVALID_NAME"),
        description: Yup.string().min(3, "ERR_HELP_INVALID_NAME")
      }),
      { title, description }
    );

    const record = await this.service.create(
      { title, description, video, link },
      companyId
    );

    return res.status(200).json(record);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;

    const record = await this.service.show(id);

    return res.status(200).json(record);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const { title, description, video, link } = req.body as UpdateHelpDto;
    const { id } = req.params;
    const { companyId } = req.user;

    await this.validateSchema(
      Yup.object().shape({ title: Yup.string().required() }),
      { title }
    );

    const record = await this.service.update(
      id,
      { title, description, video, link },
      companyId
    );

    return res.status(200).json(record);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const { companyId } = req.user;

    await this.service.delete(id, companyId);

    return res.status(200).json({ message: "Help deleted" });
  };

  public findList = async (req: Request, res: Response): Promise<Response> => {
    const records = await this.service.findList();

    return res.status(200).json(records);
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
