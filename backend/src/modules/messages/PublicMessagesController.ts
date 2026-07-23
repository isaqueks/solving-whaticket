import { Request, Response } from "express";

import { appConfig } from "../../config/AppConfig";
import AppError from "../../shared/errors/AppError";
import { SendPublicMessageDto } from "./dtos/SendPublicMessageDto";
import { MessagesService } from "./MessagesService";

/**
 * Endpoint público de envio por número (antigo PublicMessageController).
 * Autenticação por header X-API-Auth validada aqui, no boundary HTTP.
 */
export class PublicMessagesController {
  constructor(private readonly service = new MessagesService()) {}

  /**
   * POST /public/messages/send-by-number
   * Header: X-API-Auth
   * Body: { to: string, content: string }
   */
  public sendByNumber = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    this.validateApiAuth(req);

    const { to, content } = req.body as SendPublicMessageDto;

    const result = await this.service.sendByNumber({ to, content });

    return res.status(200).json({
      success: true,
      message: "Mensagem enviada com sucesso",
      data: {
        contactId: result.contactId,
        contactName: result.contactName
      }
    });
  };

  /** Valida o header X-API-Auth (comportamento original preservado). */
  private validateApiAuth(req: Request): void {
    const apiKey = req.headers["x-api-auth"];
    const expectedKey = appConfig.auth.publicApiKey;

    if (!expectedKey) {
      throw new AppError("API key não configurada no servidor", 500);
    }

    if (!apiKey) {
      throw new AppError("Header 'X-API-Auth' é obrigatório", 401);
    }

    if (apiKey !== expectedKey) {
      throw new AppError("API key inválida", 401);
    }
  }
}
