import { Request, Response } from "express";
import { head } from "lodash";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { CreateAnnouncementDto } from "./dtos/CreateAnnouncementDto";
import { UpdateAnnouncementDto } from "./dtos/UpdateAnnouncementDto";
import { AnnouncementsService } from "./AnnouncementsService";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
};

type FindQuery = {
  companyId: string;
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
export class AnnouncementsController {
  constructor(private readonly service = new AnnouncementsService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam, pageNumber } = req.query as IndexQuery;

    const { records, count, hasMore } = await this.service.list({
      searchParam,
      pageNumber
    });

    return res.json({ records, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { priority, title, text, status } = req.body as Omit<
      CreateAnnouncementDto,
      "companyId"
    >;

    await this.validateSchema(
      Yup.object().shape({ title: Yup.string().required() }),
      { title }
    );

    const record = await this.service.create({
      priority,
      title,
      text,
      status,
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
    const dto = req.body as UpdateAnnouncementDto;

    await this.validateSchema(
      Yup.object().shape({ title: Yup.string().required() }),
      { title: dto.title }
    );

    const record = await this.service.update(id, dto, companyId);

    return res.status(200).json(record);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const { companyId } = req.user;

    await this.service.delete(id, companyId);

    return res.status(200).json({ message: "Announcement deleted" });
  };

  public findList = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.query as FindQuery;

    const records = await this.service.find({ companyId });

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

    return res.send({ mensagem: "Mensagem enviada" });
  };

  public deleteMedia = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { id } = req.params;
    const { companyId } = req.user;

    await this.service.removeMedia(id, companyId);

    return res.send({ mensagem: "Arquivo excluído" });
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
