import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { logger } from "../../utils/logger";
import { CreateTicketDto } from "./dtos/CreateTicketDto";
import { UpdateTicketData } from "./dtos/UpdateTicketDto";
import { TicketByNumberService } from "./TicketByNumberService";
import { TicketsMaintenanceService } from "./TicketsMaintenanceService";
import { TicketsService } from "./TicketsService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string;
  date: string;
  updatedAt?: string;
  showAll: string;
  withUnreadMessages: string;
  queueIds: string;
  tags: string;
  users: string;
  unread?: "unread" | "read";
};

/** Contrato mínimo de schema Yup aceito pelo guard de validação. */
interface ValidatableSchema {
  validate(value: unknown): Promise<unknown>;
}

/**
 * Controller fino (doc 04 §3): parse da requisição, validação no boundary e
 * status code — negócio fica nos services do módulo. Handlers são arrow
 * properties (convenção do template B1) — sem `.bind` nas rotas.
 */
export class TicketsController {
  constructor(
    private readonly service = new TicketsService(),
    private readonly byNumberService = new TicketByNumberService(),
    private readonly maintenanceService = new TicketsMaintenanceService()
  ) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const {
      pageNumber,
      status,
      date,
      updatedAt,
      searchParam,
      showAll,
      queueIds: queueIdsStringified,
      tags: tagIdsStringified,
      users: userIdsStringified,
      withUnreadMessages,
      unread
    } = req.query as IndexQuery;

    const userId = req.user.id;
    const { companyId } = req.user;

    const queueIds = this.parseIdsParam(queueIdsStringified);
    const tagsIds = this.parseIdsParam(tagIdsStringified);
    const usersIds = this.parseIdsParam(userIdsStringified);

    const { tickets, count, hasMore } = await this.service.list({
      searchParam,
      tags: tagsIds,
      users: usersIds,
      pageNumber,
      status,
      date,
      updatedAt,
      showAll,
      userId,
      queueIds,
      withUnreadMessages,
      companyId,
      unread
    });

    return res.status(200).json({ tickets, count, hasMore });
  };

  public kanban = async (req: Request, res: Response): Promise<Response> => {
    const {
      pageNumber,
      status,
      date,
      updatedAt,
      searchParam,
      showAll,
      queueIds: queueIdsStringified,
      tags: tagIdsStringified,
      users: userIdsStringified,
      withUnreadMessages
    } = req.query as IndexQuery;

    const userId = req.user.id;
    const { companyId } = req.user;

    const queueIds = this.parseIdsParam(queueIdsStringified);
    const tagsIds = this.parseIdsParam(tagIdsStringified);
    const usersIds = this.parseIdsParam(userIdsStringified);

    const { tickets, count, hasMore } = await this.service.listKanban({
      searchParam,
      tags: tagsIds,
      users: usersIds,
      pageNumber,
      status,
      date,
      updatedAt,
      showAll,
      userId,
      queueIds,
      withUnreadMessages,
      companyId
    });

    return res.status(200).json({ tickets, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { contactId, status, userId, queueId, whatsappId } =
      req.body as Omit<CreateTicketDto, "companyId">;
    const { companyId } = req.user;

    await this.validateSchema(
      Yup.object().shape({
        contactId: Yup.number().required(),
        status: Yup.string().required()
      }),
      { contactId, status }
    );

    const ticket = await this.service.create({
      contactId,
      status,
      userId,
      companyId,
      queueId,
      whatsappId
    });

    this.service.emitTicketCreated(companyId, ticket);

    return res.status(200).json(ticket);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { ticketId } = req.params;
    const { companyId } = req.user;

    const ticket = await this.service.show(ticketId, companyId);

    return res.status(200).json(ticket);
  };

  public showFromUUID = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { uuid } = req.params;

    const ticket = await this.service.showFromUUID(uuid);

    return res.status(200).json(ticket);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const { ticketId } = req.params;
    const ticketData = req.body as UpdateTicketData;
    const { companyId } = req.user;

    const { ticket } = await this.service.update({
      ticketData,
      ticketId,
      companyId
    });

    return res.status(200).json(ticket);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { ticketId } = req.params;
    const { companyId } = req.user;

    await this.service.remove(ticketId, companyId);

    return res.status(200).json({ message: "ticket deleted" });
  };

  /** GET /ticket-by-number (absorvido do GetTicketByNumberController). */
  public getByNumber = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { phone } = req.query;
    if (typeof phone !== "string" || !/^\+?[1-9]\d{1,14}$/.test(phone)) {
      // Contrato original: falhas respondem 200 com payload de erro.
      return res.status(200).json({ error: "Phone number is required" });
    }

    const { companyId } = req.user;

    const result = await this.byNumberService.getOrCreateByNumber(
      phone,
      companyId,
      req.user.id
    );

    if (result.error) {
      return res.status(200).json({ error: result.error });
    }

    return res.status(200).json(result.ticket);
  };

  /** GET /fixTickets — dispara a varredura administrativa sem aguardar. */
  public fixTickets = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    this.maintenanceService
      .fixTickets()
      .then(() => logger.info("fixTickets: varredura concluída"))
      .catch(err => logger.error({ err }, "fixTickets: varredura falhou"));

    return res.json({ started: true });
  };

  private parseIdsParam(stringified?: string): number[] {
    if (!stringified) {
      return [];
    }

    return JSON.parse(stringified);
  }

  /** Converte falha de validação Yup em AppError 400 (padrão do template). */
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
