import { Request, Response } from "express";

// Ciclo WhatsappService ⇄ módulo da sessão: usar o singleton SEMPRE dentro do
// corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { whatsappService } from "../whatsapp/WhatsappService";

import { whatsappSessionService } from "./WhatsappSessionService";

/**
 * Controller fino (doc 04 §3) do RUNTIME da sessão wbot — iniciar, reiniciar e
 * desconectar (o CRUD da conexão vive em modules/whatsapp). Paths/verbos
 * idênticos aos do antigo WhatsAppSessionController.
 *
 * Convenção do template (B1): handlers são ARROW PROPERTIES da classe.
 */
export class WhatsappSessionController {
  public store = async (req: Request, res: Response): Promise<Response> => {
    const { whatsappId } = req.params;
    const { companyId } = req.user;

    const whatsapp = await whatsappService.show(whatsappId, companyId);
    await whatsappSessionService.start(whatsapp, companyId);

    return res.status(200).json({ message: "Starting session." });
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const { whatsappId } = req.params;
    const { companyId } = req.user;

    const { whatsapp } = await whatsappService.update({
      whatsappId,
      companyId,
      whatsappData: { session: "" }
    });

    await whatsappSessionService.start(whatsapp, companyId);

    return res.status(200).json({ message: "Starting session." });
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { whatsappId } = req.params;
    const { companyId } = req.user;

    await whatsappSessionService.disconnect(whatsappId, companyId);

    return res.status(200).json({ message: "Session disconnected." });
  };
}
