import { Request, Response } from "express";
import { head } from "lodash";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { ContactListsService } from "./ContactListsService";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
};

/** Contrato mínimo de schema Yup aceito pelo guard de validação. */
interface ValidatableSchema {
  validate(value: unknown): Promise<unknown>;
}

/**
 * Controller fino (doc 04 §3): parse da requisição, validação Yup no boundary
 * e status code — negócio no service. Handlers são ARROW PROPERTIES (convenção
 * do template B1): `this` preso à instância, sem `.bind` nas rotas.
 */
export class ContactListsController {
  constructor(private readonly service = new ContactListsService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam, pageNumber } = req.query as IndexQuery;
    const { companyId } = req.user;

    const { records, count, hasMore } = await this.service.list({
      searchParam,
      pageNumber,
      companyId
    });

    return res.json({ records, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { name } = req.body as { name: string };
    const { companyId } = req.user;

    // Funde as duas validações do legado (controller `required` + service
    // `min(3)`) numa só no boundary, PRESERVANDO os códigos de erro estáveis.
    await this.validateSchema(
      Yup.object().shape({
        name: Yup.string()
          .min(3, "ERR_CONTACTLIST_INVALID_NAME")
          .required("ERR_CONTACTLIST_REQUIRED")
      }),
      { name }
    );

    const record = await this.service.create({ name, companyId });

    return res.status(200).json(record);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;

    const record = await this.service.show(id);

    return res.status(200).json(record);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const { name } = req.body as { name: string };
    const { companyId } = req.user;

    await this.validateSchema(
      Yup.object().shape({ name: Yup.string().required() }),
      { name }
    );

    const record = await this.service.update(id, { name }, companyId);

    return res.status(200).json(record);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const { companyId } = req.user;

    await this.service.delete(id, companyId);

    return res.status(200).json({ message: "Contact list deleted" });
  };

  public findList = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.query as { companyId: string };

    const records = await this.service.findByCompany({ companyId });

    return res.status(200).json(records);
  };

  public upload = async (req: Request, res: Response): Promise<Response> => {
    const files = req.files as Express.Multer.File[];
    const file = head(files);
    const { id } = req.params;
    const { companyId } = req.user;

    const response = await this.service.importContacts(+id, companyId, file);

    return res.status(200).json(response);
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
