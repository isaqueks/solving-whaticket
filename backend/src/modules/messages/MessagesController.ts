import { Request, Response } from "express";

import { ForwardMessagesDto } from "./dtos/ForwardMessagesDto";
import { ApiMessagePayload } from "./dtos/SendApiMessageDto";
import Message from "./models/Message";
import { MessagesService } from "./MessagesService";

type IndexQuery = {
  pageNumber: string;
};

type MessageBody = {
  body: string;
  quotedMsg?: Message;
  editMsg?: Message;
};

/**
 * Controller fino (doc 04 §3): parse da requisição e status code — upload,
 * validações e orquestração de envio ficam no MessagesService. Handlers são
 * arrow properties (convenção do template B1) — sem `.bind` nas rotas.
 */
export class MessagesController {
  constructor(private readonly service = new MessagesService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { ticketId } = req.params;
    const { pageNumber } = req.query as IndexQuery;
    const { companyId, profile } = req.user;

    const { count, messages, ticket, hasMore } =
      await this.service.listForRequest({
        pageNumber,
        ticketId,
        companyId,
        profile,
        userId: req.user.id
      });

    return res.json({ count, messages, ticket, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { ticketId } = req.params;
    const { body, quotedMsg, editMsg } = req.body as MessageBody;
    const medias = req.files as Express.Multer.File[];
    const { companyId } = req.user;

    await this.service.sendTicketMessage({
      ticketId,
      companyId,
      userId: +req.user.id,
      body,
      quotedMsg,
      editMsg,
      medias
    });

    return res.send();
  };

  public forward = async (req: Request, res: Response): Promise<Response> => {
    const { contactId, whatsappId, messagesId } = req.body as ForwardMessagesDto;

    await this.service.forward({
      contactId,
      whatsappId,
      messagesId
    });

    return res.send();
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { messageId } = req.params;
    const { companyId } = req.user;

    await this.service.delete(messageId, companyId);

    return res.send();
  };

  /** POST /api/messages/send — API externa autenticada por token da conexão. */
  public send = async (req: Request, res: Response): Promise<Response> => {
    const { whatsappId } = req.params as unknown as { whatsappId: number };
    const messageData = req.body as ApiMessagePayload;
    const medias = req.files as Express.Multer.File[];

    await this.service.sendApiMessage({
      whatsappId,
      messageData,
      medias,
      requestUser: req.user
    });

    return res.send({ mensagem: "Mensagem enviada" });
  };
}
