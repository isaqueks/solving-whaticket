import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { ContactListItemsService } from "./ContactListItemsService";
import { CreateContactListItemDto } from "./dtos/CreateContactListItemDto";
import { FindContactListItemsFilters } from "./dtos/FindContactListItemsFilters";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
  contactListId: string | number;
};

/** Contrato mínimo de schema Yup aceito pelo guard de validação. */
interface ValidatableSchema {
  validate(value: unknown): Promise<unknown>;
}

/**
 * Controller fino (doc 04 §3) do sub-recurso ContactListItems. Handlers são
 * ARROW PROPERTIES (convenção do template B1): `this` preso à instância, sem
 * `.bind` nas rotas.
 */
export class ContactListItemsController {
  constructor(private readonly service = new ContactListItemsService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam, pageNumber, contactListId } = req.query as IndexQuery;
    const { companyId } = req.user;

    const { contacts, count, hasMore } = await this.service.list({
      searchParam,
      pageNumber,
      companyId,
      contactListId
    });

    return res.json({ contacts, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { name, number, contactListId, email } = req.body as Omit<
      CreateContactListItemDto,
      "companyId"
    >;

    // Funde as duas validações do legado (controller `required` + service
    // `min(3)`) numa só no boundary, PRESERVANDO os códigos de erro estáveis.
    await this.validateSchema(
      Yup.object().shape({
        name: Yup.string()
          .min(3, "ERR_CONTACTLISTITEM_INVALID_NAME")
          .required("ERR_CONTACTLISTITEM_REQUIRED")
      }),
      { name }
    );

    const record = await this.service.create({
      name,
      number,
      contactListId,
      email,
      companyId
    });

    return res.status(200).json(record);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;

    const record = await this.service.show(id);

    return res.status(200).json(record);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const { companyId } = req.user;
    const { name, number, email } = req.body as {
      name: string;
      number: string;
      email?: string;
    };

    await this.validateSchema(
      Yup.object().shape({ name: Yup.string().required() }),
      { name }
    );

    const record = await this.service.update(
      id,
      { name, number, email },
      companyId
    );

    return res.status(200).json(record);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const { companyId } = req.user;

    await this.service.delete(id, companyId);

    return res.status(200).json({ message: "Contact deleted" });
  };

  public findList = async (req: Request, res: Response): Promise<Response> => {
    // Escopo (companyId + contactListId) vem da query, como no findList legado.
    const params = req.query as unknown as FindContactListItemsFilters;

    const records = await this.service.findByCompanyAndList(params);

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
