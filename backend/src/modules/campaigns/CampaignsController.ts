import { Request, Response } from "express";
import { head } from "lodash";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { logger } from "../../utils/logger";
import { StoreCampaignBody } from "./dtos/CreateCampaignDto";
import { FindCampaignsFilters } from "./dtos/FindCampaignsFilters";
import { UpdateCampaignDto } from "./dtos/UpdateCampaignDto";
import { CampaignsService, campaignsService } from "./CampaignsService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
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
export class CampaignsController {
  constructor(private readonly service: CampaignsService = campaignsService) {}

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
    const { companyId } = req.user;
    const data = req.body as StoreCampaignBody;

    await this.validateSchema(
      Yup.object().shape({ name: Yup.string().required() }),
      data
    );

    if (typeof data.tagListId === "number") {
      // Fluxo tag→lista: o contrato HTTP original responde 500 com payload
      // próprio para QUALQUER falha deste ramo (inclusive validação do
      // create), não o handler global de AppError — preservado no boundary.
      try {
        const record = await this.service.createFromTag(
          { ...data, companyId },
          data.tagListId
        );

        return res.status(200).json(record);
      } catch (error) {
        logger.error(
          { err: error },
          "Falha ao criar campanha a partir da tag %d",
          data.tagListId
        );
        return res.status(500).json({ error: "Error creating contact list" });
      }
    }

    const record = await this.service.create({ ...data, companyId });

    return res.status(200).json(record);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;

    const record = await this.service.show(id);

    return res.status(200).json(record);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const data = req.body as Omit<UpdateCampaignDto, "id">;
    const { companyId } = req.user;

    await this.validateSchema(
      Yup.object().shape({ name: Yup.string().required() }),
      data
    );

    const { id } = req.params;

    const record = await this.service.update({ ...data, id }, companyId);

    return res.status(200).json(record);
  };

  public cancel = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;

    await this.service.cancel(+id);

    return res.status(204).json({ message: "Cancelamento realizado" });
  };

  public restart = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;

    await this.service.restart(+id);

    return res.status(204).json({ message: "Reinício dos disparos" });
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const { companyId } = req.user;

    await this.service.delete(id, companyId);

    return res.status(200).json({ message: "Campaign deleted" });
  };

  public findList = async (req: Request, res: Response): Promise<Response> => {
    const params = req.query as FindCampaignsFilters;
    const records = await this.service.find(params);

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

    await this.service.removeMedia(id);

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
