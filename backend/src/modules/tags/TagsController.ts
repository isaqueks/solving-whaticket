import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { logger } from "../../utils/logger";
import { CreateTagDto } from "./dtos/CreateTagDto";
import { SyncTagsDto } from "./dtos/SyncTagsDto";
import { UpdateTagDto } from "./dtos/UpdateTagDto";
import { TagsService } from "./TagsService";

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
 * boundary, permissão e status code — negócio fica no service.
 *
 * Convenção do template (B1): handlers são ARROW PROPERTIES da classe —
 * `this` já fica preso à instância, dispensando `.bind` no arquivo de rotas.
 */
export class TagsController {
  constructor(private readonly service = new TagsService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { pageNumber, searchParam } = req.query as IndexQuery;
    const { companyId } = req.user;

    const { tags, count, hasMore } = await this.service.list({
      searchParam,
      pageNumber,
      companyId
    });

    return res.json({ tags, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { name, color, kanban } = req.body as Omit<CreateTagDto, "companyId">;
    const { companyId } = req.user;

    await this.validateSchema(
      Yup.object().shape({ name: Yup.string().required().min(3) }),
      { name }
    );

    const tag = await this.service.create({ name, color, kanban, companyId });

    return res.status(200).json(tag);
  };

  public kanban = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;

    const tags = await this.service.kanbanList(companyId);

    // Payload padronizado (era `{ lista: tags }`) — par frontend: pages/Kanban.
    return res.json({ tags });
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { tagId } = req.params;

    const tag = await this.service.show(tagId);

    return res.status(200).json(tag);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    this.ensureAdmin(req);

    const { tagId } = req.params;
    const dto = req.body as UpdateTagDto;

    await this.validateSchema(
      Yup.object().shape({ name: Yup.string().min(3) }),
      { name: dto.name }
    );

    const tag = await this.service.update(tagId, dto, req.user.companyId);

    return res.status(200).json(tag);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    // Fix aprovado (B1): remove passa a exigir admin, como update já exigia.
    this.ensureAdmin(req);

    const { tagId } = req.params;

    await this.service.delete(tagId, req.user.companyId);

    return res.status(200).json({ message: "Tag deleted" });
  };

  public list = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam } = req.query as IndexQuery;
    const { companyId } = req.user;

    const tags = await this.service.simpleList({ searchParam, companyId });

    return res.json(tags);
  };

  public syncTags = async (req: Request, res: Response): Promise<Response> => {
    const { ticketId, tags } = req.body as SyncTagsDto;

    await this.validateSchema(
      Yup.object().shape({
        ticketId: Yup.number().required(),
        tags: Yup.array().required()
      }),
      { ticketId, tags }
    );

    const ticket = await this.service.syncTags({ ticketId, tags });

    return res.json(ticket);
  };

  // ── Junção ticket↔tag (absorvida do TicketTagController na B2) ─────────────
  // O contrato HTTP original mapeia falha para 500 com payload próprio (não o
  // handler global de AppError); por isso o try/catch fica aqui, no boundary,
  // e o erro é logado (regressão de catch vazio já corrigida antes — doc 04 §6).

  public storeTicketTag = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { ticketId, tagId } = req.params;

    try {
      const ticketTag = await this.service.linkTag({ ticketId, tagId });
      return res.status(201).json(ticketTag);
    } catch (err) {
      logger.error(
        { err },
        "Falha ao vincular tag %s ao ticket %s",
        tagId,
        ticketId
      );
      return res.status(500).json({ error: "Failed to store ticket tag." });
    }
  };

  public removeTicketTags = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { ticketId } = req.params;

    try {
      await this.service.removeKanbanTags(ticketId);
      return res
        .status(200)
        .json({ message: "Ticket tags removed successfully." });
    } catch (err) {
      logger.error({ err }, "Falha ao remover tags do ticket %s", ticketId);
      return res.status(500).json({ error: "Failed to remove ticket tags." });
    }
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
