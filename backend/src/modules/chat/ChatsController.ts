import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { ChatParticipantInput } from "./dtos/ChatParticipantInput";
import { ChatsService } from "./ChatsService";

type IndexQuery = {
  pageNumber?: string;
};

type ChatBody = {
  title?: string;
  users?: ChatParticipantInput[];
};

/** Contrato mínimo de schema Yup aceito pelo guard de validação. */
interface ValidatableSchema {
  validate(value: unknown): Promise<unknown>;
}

/**
 * Controller fino (doc 04 §3) do Chat interno: parse da requisição, validação
 * Yup no boundary e status code — negócio e realtime ficam no service. Absorve
 * os 8 handlers do antigo `controllers/ChatController.ts` (inclusive os 7
 * blocos de emissão de socket, agora no service via RealtimeGateway).
 *
 * Convenção do template (B1): handlers são ARROW PROPERTIES da classe.
 */
export class ChatsController {
  constructor(private readonly service = new ChatsService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { pageNumber } = req.query as IndexQuery;
    const ownerId = +req.user.id;

    const { records, count, hasMore } = await this.service.list({
      ownerId,
      pageNumber
    });

    return res.json({ records, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { title, users } = req.body as ChatBody;
    const { companyId } = req.user;
    const ownerId = +req.user.id;

    await this.validateSchema(
      Yup.object().shape({
        title: Yup.string(),
        users: Yup.array().required()
      }),
      { title, users }
    );

    const record = await this.service.create({
      title,
      users,
      ownerId,
      companyId
    });

    return res.status(200).json(record);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const { title, users } = req.body as ChatBody;
    const { companyId } = req.user;
    const { id } = req.params;

    await this.validateSchema(
      Yup.object().shape({ title: Yup.string() }),
      { title }
    );

    const record = await this.service.update({
      id: +id,
      companyId,
      title,
      users
    });

    return res.status(200).json(record);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;

    const record = await this.service.showByUuid(id);

    return res.status(200).json(record);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const { companyId } = req.user;

    await this.service.delete(id, companyId);

    return res.status(200).json({ message: "Chat deleted" });
  };

  public saveMessage = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { companyId } = req.user;
    const { message } = req.body as { message: string };
    const { id } = req.params;
    const senderId = +req.user.id;

    await this.validateSchema(
      Yup.object().shape({ message: Yup.string().required() }),
      { message }
    );

    const newMessage = await this.service.createMessage({
      chatId: +id,
      senderId,
      message,
      companyId
    });

    return res.json(newMessage);
  };

  public checkAsRead = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { companyId } = req.user;
    const { userId } = req.body as { userId: number };
    const { id } = req.params;

    await this.validateSchema(
      Yup.object().shape({ userId: Yup.number().required() }),
      { userId }
    );

    const chat = await this.service.markAsRead({
      chatId: id,
      userId,
      companyId
    });

    return res.json(chat);
  };

  public messages = async (req: Request, res: Response): Promise<Response> => {
    const { pageNumber } = req.query as IndexQuery;
    const { id: chatId } = req.params;
    const ownerId = +req.user.id;

    const { records, count, hasMore } = await this.service.findMessages({
      chatId,
      ownerId,
      pageNumber
    });

    return res.json({ records, count, hasMore });
  };

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
