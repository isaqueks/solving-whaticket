import { Request, Response } from "express";
import { head } from "lodash";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { QuickMessagesService } from "./QuickMessagesService";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
  userId?: string;
};

type StoreData = {
  shortcode: string;
  message: string;
};

type FindQuery = {
  companyId: string;
  userId: string;
};

/** Contrato mínimo de schema Yup aceito pelo guard de validação. */
interface ValidatableSchema {
  validate(value: unknown): Promise<unknown>;
}

/**
 * Controller fino (doc 04 §3): parse da requisição, validação Yup no boundary,
 * status code — negócio fica no service. Handlers são ARROW PROPERTIES
 * (convenção do template B1): `this` preso à instância, sem `.bind` nas rotas.
 */
export class QuickMessagesController {
  constructor(private readonly service = new QuickMessagesService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam, pageNumber, userId } = req.query as IndexQuery;
    const { companyId } = req.user;

    const { records, count, hasMore } = await this.service.list({
      searchParam,
      pageNumber,
      companyId,
      userId
    });

    return res.json({ records, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { companyId, id: userId } = req.user;
    const { shortcode, message } = req.body as StoreData;

    await this.validateSchema(
      Yup.object().shape({
        shortcode: Yup.string()
          .min(3, "ERR_QUICKMESSAGE_INVALID_NAME")
          .required("ERR_QUICKMESSAGE_REQUIRED"),
        message: Yup.string()
          .min(3, "ERR_QUICKMESSAGE_INVALID_NAME")
          .required("ERR_QUICKMESSAGE_REQUIRED")
      }),
      { shortcode, message }
    );

    const record = await this.service.create({
      shortcode,
      message,
      companyId,
      userId
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
    const { companyId, id: userId } = req.user;
    const { shortcode, message } = req.body as StoreData;

    await this.validateSchema(
      Yup.object().shape({
        shortcode: Yup.string().required(),
        message: Yup.string().required()
      }),
      { shortcode, message }
    );

    const record = await this.service.update(
      id,
      { shortcode, message, userId },
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
    const { companyId, userId } = req.query as FindQuery;

    const records = await this.service.find({ companyId, userId });

    return res.status(200).json(records);
  };

  public mediaUpload = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { id } = req.params;
    const { companyId } = req.user;
    const files = req.files as Express.Multer.File[];
    const file = head(files);

    await this.service.attachMedia(id, file, companyId);

    return res.send({ mensagem: "Arquivo Anexado" });
  };

  public deleteMedia = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { id } = req.params;

    await this.service.removeMedia(id);

    return res.send({ mensagem: "Arquivo Excluído" });
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
