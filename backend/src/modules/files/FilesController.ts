import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { CreateFileListDto } from "./dtos/CreateFileListDto";
import { UpdateFileListDto } from "./dtos/UpdateFileListDto";
import { FilesService } from "./FilesService";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string | number;
};

type UploadMediasBody = {
  fileId: string | number;
  id: string | number | Array<string | number>;
  mediaType: string | string[];
};

/** Contrato mínimo de schema Yup aceito pelo guard de validação. */
interface ValidatableSchema {
  validate(value: unknown): Promise<unknown>;
}

/**
 * Controller fino (doc 04 §3) do domínio Files (listas de arquivos): parse da
 * requisição, validação Yup no boundary, guard de permissão — negócio no
 * service. Handlers são ARROW PROPERTIES (convenção do template B1): `this`
 * preso à instância, sem `.bind` nas rotas.
 */
export class FilesController {
  constructor(private readonly service = new FilesService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { pageNumber, searchParam } = req.query as IndexQuery;
    const { companyId } = req.user;

    const { files, count, hasMore } = await this.service.list({
      searchParam,
      pageNumber,
      companyId
    });

    return res.json({ files, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { name, message, options } = req.body as Omit<
      CreateFileListDto,
      "companyId"
    >;
    const { companyId } = req.user;

    await this.validateSchema(
      Yup.object().shape({ name: Yup.string().required().min(3) }),
      { name }
    );

    const fileList = await this.service.create({
      name,
      message,
      options,
      companyId
    });

    return res.status(200).json(fileList);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { fileId } = req.params;
    const { companyId } = req.user;

    const file = await this.service.show(fileId, companyId);

    return res.status(200).json(file);
  };

  public uploadMedias = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { fileId, id, mediaType } = req.body as UploadMediasBody;
    const { companyId } = req.user;
    const files = req.files as Express.Multer.File[];

    await this.service.attachMedias({
      fileId,
      optionIds: id,
      mediaTypes: mediaType,
      files,
      companyId
    });

    return res.send({ mensagem: "Arquivos atualizados" });
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    this.ensureAdmin(req);

    const { fileId } = req.params;
    const { companyId } = req.user;
    const fileData = req.body as UpdateFileListDto;

    await this.validateSchema(
      Yup.object().shape({ name: Yup.string().min(3) }),
      { name: fileData.name }
    );

    const fileList = await this.service.update(fileId, fileData, companyId);

    return res.status(200).json(fileList);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { fileId } = req.params;
    const { companyId } = req.user;

    await this.service.delete(fileId, companyId);

    return res.status(200).json({ message: "File List deleted" });
  };

  public removeAll = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { companyId } = req.user;

    await this.service.deleteAll(companyId);

    return res.send();
  };

  public list = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam } = req.query as IndexQuery;
    const { companyId } = req.user;

    const files = await this.service.simpleList({ searchParam, companyId });

    return res.json(files);
  };

  /** Só admin edita listas de arquivos (guard original do handler `update`). */
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
