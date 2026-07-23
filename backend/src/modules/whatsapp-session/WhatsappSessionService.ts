import * as Sentry from "@sentry/node";

import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { logger } from "../../utils/logger";

import Whatsapp from "../whatsapp/models/Whatsapp";
import { WhatsappRepository } from "../whatsapp/WhatsappRepository";
// Ciclo WhatsappService ⇄ módulo da sessão: usar o singleton SEMPRE dentro do
// corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { whatsappService } from "../whatsapp/WhatsappService";

// Colaboradores do módulo referenciados só em tempo de chamada — o grafo
// SessionManager ⇄ WhatsappSessionService é cíclico (reconnect reinicia a
// sessão por aqui).
import { messageListener } from "./MessageListener";
import { sessionManager } from "./SessionManager";
import { sessionMonitor } from "./SessionMonitor";

/**
 * Orquestração do ciclo de vida das sessões (antigos `StartWhatsAppSession` e
 * `StartAllWhatsAppsSessions`): marca a conexão como OPENING, inicia o socket
 * e pendura listener + monitor. Lógica preservada.
 */
export class WhatsappSessionService {
  constructor(
    private readonly whatsappRepository = new WhatsappRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  /** Inicia (ou reinicia) a sessão de uma conexão (antigo StartWhatsAppSession). */
  public async start(whatsapp: Whatsapp, companyId: number): Promise<void> {
    await this.whatsappRepository.update(whatsapp, { status: "OPENING" });

    this.realtime.emitToMainChannel(
      whatsapp.companyId,
      SocketEvents.companyWhatsappSession(whatsapp.companyId),
      {
        action: "update",
        session: whatsapp
      }
    );

    try {
      const wbot = await sessionManager.initWASocket(whatsapp);
      messageListener.register(wbot, companyId);
      sessionMonitor.attach(wbot, whatsapp, companyId);
    } catch (err) {
      Sentry.captureException(err);
      logger.error(err);
    }
  }

  /** Inicia todas as sessões da empresa (antigo StartAllWhatsAppsSessions). */
  public async startAll(companyId: number): Promise<void> {
    try {
      const whatsapps = await whatsappService.list({ companyId });
      if (whatsapps.length > 0) {
        whatsapps.forEach(whatsapp => {
          this.start(whatsapp, companyId);
        });
      }
    } catch (e) {
      Sentry.captureException(e);
    }
  }

  /**
   * Desconecta a sessão de uma conexão (lógica movida do antigo
   * WhatsAppSessionController.remove — o controller não toca em model).
   */
  public async disconnect(
    whatsappId: string | number,
    companyId: number
  ): Promise<void> {
    const whatsapp = await whatsappService.show(whatsappId, companyId);

    if (whatsapp.session) {
      await this.whatsappRepository.update(whatsapp, {
        status: "DISCONNECTED",
        session: ""
      });
      const wbot = sessionManager.getWbot(whatsapp.id);
      await wbot.logout();
    }
  }
}

export const whatsappSessionService = new WhatsappSessionService();
