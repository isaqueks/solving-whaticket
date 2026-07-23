import { Request, Response } from "express";
import { head } from "lodash";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { CreateScheduleDto } from "./dtos/CreateScheduleDto";
import { UpdateScheduleDto } from "./dtos/UpdateScheduleDto";
import { SchedulesService } from "./SchedulesService";

type IndexQuery = {
  searchParam?: string;
  contactId?: number | string;
  userId?: number | string;
  pageNumber?: string | number;
};

/** Contrato mínimo de schema Yup aceito pelo guard de validação. */
interface ValidatableSchema {
  validate(value: unknown): Promise<unknown>;
}

/**
 * Controller fino (doc 04 §3): parse da requisição, validação Yup no
 * boundary, permissão e status code — negócio fica no service.
 *
 * Convenção do template (B1): handlers são ARROW PROPERTIES da classe —
 * `this` já fica preso à instância, dispensando `.bind` no arquivo de rotas.
 */
export class SchedulesController {
  constructor(private readonly service = new SchedulesService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { contactId, userId, pageNumber, searchParam } =
      req.query as IndexQuery;
    const { companyId } = req.user;

    const { schedules, count, hasMore } = await this.service.list({
      searchParam,
      contactId,
      userId,
      pageNumber,
      companyId
    });

    return res.json({ schedules, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { body, sendAt, contactId, userId } = req.body as Omit<
      CreateScheduleDto,
      "companyId"
    >;
    const { companyId } = req.user;

    await this.validateSchema(
      Yup.object().shape({
        body: Yup.string().required().min(5),
        sendAt: Yup.string().required()
      }),
      { body, sendAt }
    );

    const schedule = await this.service.create({
      body,
      sendAt,
      contactId,
      companyId,
      userId
    });

    return res.status(200).json(schedule);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { scheduleId } = req.params;
    const { companyId } = req.user;

    const schedule = await this.service.show(scheduleId, companyId);

    return res.status(200).json(schedule);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    this.ensureAdmin(req);

    const { scheduleId } = req.params;
    const dto = req.body as UpdateScheduleDto;
    const { companyId } = req.user;

    await this.validateSchema(
      Yup.object().shape({ body: Yup.string().min(5) }),
      { body: dto.body }
    );

    const schedule = await this.service.update(scheduleId, dto, companyId);

    return res.status(200).json(schedule);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { scheduleId } = req.params;
    const { companyId } = req.user;

    await this.service.delete(scheduleId, companyId);

    return res.status(200).json({ message: "Schedule deleted" });
  };

  public mediaUpload = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];
    const file = head(files);

    await this.service.uploadMedia(id, file);

    return res.send({ mensagem: "Arquivo Anexado" });
  };

  public deleteMedia = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { id } = req.params;

    await this.service.deleteMedia(id);

    return res.send({ mensagem: "Arquivo Excluído" });
  };

  private ensureAdmin(req: Request): void {
    if (req.user.profile !== "admin") {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

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
