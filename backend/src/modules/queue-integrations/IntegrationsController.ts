import { Request, Response } from "express";

import AppError from "../../shared/errors/AppError";
import Whatsapp from "../whatsapp/models/Whatsapp";
// Ciclo WhatsappService ⇄ módulo da sessão: usar o singleton SEMPRE dentro do
// corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { whatsappService } from "../whatsapp/WhatsappService";

type Body = {
  to: string;
  message: string;
};

/**
 * Rota POST /integrationRoutes (antigo IntegrationController) — envio avulso
 * de mensagem por integração externa.
 *
 * KILL SWITCH INTENCIONAL: o handler lança ERR_INTEGRATION_DISABLED na
 * primeira linha (rota desativada de propósito pelo dono; antes era
 * `Error("Disabled")` → 500 genérico). O fluxo original abaixo do throw fica
 * preservado — inclusive o acesso direto ao model, exceção justificada (doc
 * 04, preâmbulo) — para documentar o comportamento caso seja religado.
 */
export class IntegrationsController {
  public index = async (req: Request, res: Response): Promise<Response> => {
    // Rota desativada de propósito; antes: Error("Disabled") → 500 genérico.
    throw new AppError("ERR_INTEGRATION_DISABLED", 403);

    const body = req.body as Body;

    const whats = await Whatsapp.findOne({
      where: {
        status: "CONNECTED"
      }
    });

    if (!whats) {
      return res.status(400).json({
        error: "No WhatsApp connected"
      });
    }

    const wbot = await whatsappService.getWhatsappWbot(whats);
    if (!wbot) {
      return res.status(400).json({
        error: "WhatsApp not found"
      });
    }

    await wbot.sendMessage(body.to, {
      text: body.message
    });

    return res.json({
      success: true
    });
  };
}
