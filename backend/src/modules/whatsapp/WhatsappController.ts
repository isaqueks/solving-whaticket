import { Request, Response } from "express";

// Runtime da sessão wbot (módulo whatsapp-session, B5) — singletons usados
// apenas dentro dos handlers (grupo cíclico whatsapp ⇄ whatsapp-session).
import { sessionManager } from "../whatsapp-session/SessionManager";
import { whatsappSessionService } from "../whatsapp-session/WhatsappSessionService";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { CreateWhatsappDto } from "./dtos/CreateWhatsappDto";
import { UpdateWhatsappData } from "./dtos/UpdateWhatsappDto";
import Whatsapp from "./models/Whatsapp";
import { WhatsappService } from "./WhatsappService";

type QueryParams = {
  session?: number | string;
};

/**
 * Controller fino (doc 04 §3) do CRUD de conexões Whatsapp — NÃO o runtime da
 * sessão wbot (B5, WhatsAppSessionController).
 *
 * Convenção do template (B1): handlers são ARROW PROPERTIES da classe.
 *
 * A emissão dos eventos `company-${id}-whatsapp` vive aqui, roteada pelo
 * RealtimeGateway (não `io.to` direto). É uma exceção justificada ao doc 04 §7
 * (emissão pelos services): o `WhatsappService.update` é compartilhado com o
 * WhatsAppSessionController (B5), que reseta a sessão SEM emitir — emitir no
 * service passaria a disparar evento naquele fluxo, mudando o comportamento.
 * A orquestração de sessão (whatsappSessionService.start / removeWbot) também
 * é runtime wbot (modules/whatsapp-session) e permanece no boundary.
 */
export class WhatsappController {
  constructor(
    private readonly service = new WhatsappService(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { session } = req.query as QueryParams;

    const whatsapps = await this.service.list({ companyId, session });

    return res.status(200).json(whatsapps);
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const {
      name,
      status,
      isDefault,
      greetingMessage,
      complationMessage,
      outOfHoursMessage,
      queueIds,
      token,
      transferQueueId,
      timeToTransfer,
      promptId,
      maxUseBotQueues,
      timeUseBotQueues,
      expiresTicket,
      expiresInactiveMessage
    } = req.body as Omit<CreateWhatsappDto, "companyId">;
    const { companyId } = req.user;

    const { whatsapp, oldDefaultWhatsapp } = await this.service.create({
      name,
      status,
      isDefault,
      greetingMessage,
      complationMessage,
      outOfHoursMessage,
      queueIds,
      companyId,
      token,
      transferQueueId,
      timeToTransfer,
      promptId,
      maxUseBotQueues,
      timeUseBotQueues,
      expiresTicket,
      expiresInactiveMessage
    });

    whatsappSessionService.start(whatsapp, companyId);

    this.emitWhatsappUpdate(companyId, whatsapp);
    if (oldDefaultWhatsapp) {
      this.emitWhatsappUpdate(companyId, oldDefaultWhatsapp);
    }

    return res.status(200).json(whatsapp);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { whatsappId } = req.params;
    const { companyId } = req.user;
    const { session } = req.query;

    const whatsapp = await this.service.show(whatsappId, companyId, session);

    return res.status(200).json(whatsapp);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const { whatsappId } = req.params;
    const whatsappData = req.body as UpdateWhatsappData;
    const { companyId } = req.user;

    const { whatsapp, oldDefaultWhatsapp } = await this.service.update({
      whatsappData,
      whatsappId,
      companyId
    });

    this.emitWhatsappUpdate(companyId, whatsapp);
    if (oldDefaultWhatsapp) {
      this.emitWhatsappUpdate(companyId, oldDefaultWhatsapp);
    }

    return res.status(200).json(whatsapp);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { whatsappId } = req.params;
    const { companyId } = req.user;

    await this.service.show(whatsappId, companyId);

    await this.service.delete(whatsappId);
    sessionManager.removeWbot(+whatsappId);

    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyWhatsapp(companyId),
      { action: "delete", whatsappId: +whatsappId }
    );

    return res.status(200).json({ message: "Whatsapp deleted." });
  };

  private emitWhatsappUpdate(companyId: number, whatsapp: Whatsapp): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyWhatsapp(companyId),
      { action: "update", whatsapp }
    );
  }
}
