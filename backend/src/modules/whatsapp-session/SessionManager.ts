import * as Sentry from "@sentry/node";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  CacheStore
} from "baileys";
import MAIN_LOGGER from "baileys/lib/Utils/logger";
import { Boom } from "@hapi/boom";
import NodeCache from "node-cache";

import { appConfig } from "../../config/AppConfig";
import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { logger } from "../../utils/logger";

import Whatsapp from "../whatsapp/models/Whatsapp";
import { WhatsappRepository } from "../whatsapp/WhatsappRepository";

import { BaileysStore } from "./BaileysStore";
import { SessionCredentialsStore } from "./SessionCredentialsStore";
import { Session } from "./types";
// O import abaixo participa do ciclo SessionManager ⇄ WhatsappSessionService
// (o service inicia sessões por aqui; o reconnect daqui reinicia pelo service)
// — usar o singleton SEMPRE dentro do corpo dos métodos (binding CommonJS
// resolve lazy na chamada, nunca capturar no construtor).
import { whatsappSessionService } from "./WhatsappSessionService";

const loggerBaileys = MAIN_LOGGER.child({});
loggerBaileys.level = "error";

/**
 * Runtime das sessões Baileys (antigo `libs/wbot.ts`): mantém o array de
 * sessões ativas e o mapa de retries de QR Code como estado da instância
 * (singleton de processo — semântica idêntica ao estado de módulo anterior).
 *
 * A semântica da promise de `initWASocket` é preservada EXATAMENTE:
 * resolve no "open"; rejeita nos caminhos terminais (403, logged out,
 * conexão fechada antes de abrir, retries de QR excedidos, erro de setup).
 * Rejeições tardias (pós-resolve) são ignoradas pela Promise.
 */
export class SessionManager {
  private readonly sessions: Session[] = [];

  private readonly retriesQrCodeMap = new Map<number, number>();

  constructor(
    private readonly whatsappRepository = new WhatsappRepository(),
    private readonly credentialsStore = new SessionCredentialsStore(),
    private readonly baileysStore = new BaileysStore(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public getWbot(whatsappId: number): Session {
    const sessionIndex = this.sessions.findIndex(s => s.id === whatsappId);

    if (sessionIndex === -1) {
      throw new AppError("ERR_WAPP_NOT_INITIALIZED");
    }
    return this.sessions[sessionIndex];
  }

  public async removeWbot(
    whatsappId: number,
    isLogout = true
  ): Promise<void> {
    try {
      const sessionIndex = this.sessions.findIndex(s => s.id === whatsappId);
      if (sessionIndex !== -1) {
        if (isLogout) {
          await this.sessions[sessionIndex].logout();
          this.sessions[sessionIndex].ws.close();
        }

        this.sessions.splice(sessionIndex, 1);
      }
    } catch (err) {
      logger.error(err);
    }
  }

  public async initWASocket(whatsapp: Whatsapp): Promise<Session> {
    return new Promise<Session>((resolve, reject) => {
      (async () => {
        const whatsappUpdate = await this.whatsappRepository.findById(
          whatsapp.id
        );

        if (!whatsappUpdate) {
          reject(new AppError("ERR_WAPP_NOT_FOUND"));
          return;
        }

        const { id, name, provider } = whatsappUpdate;

        let versionObj;
        if (appConfig.wpp.versionJson) {
          versionObj = {
            version: JSON.parse(appConfig.wpp.versionJson),
            isLatest: true
          };
        } else {
          versionObj = await fetchLatestBaileysVersion();
        }

        const { version, isLatest } = versionObj;
        const isLegacy = provider === "stable" ? true : false;

        logger.info(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
        logger.info(`isLegacy: ${isLegacy}`);
        logger.info(`Starting session ${name}`);

        let wsocket: Session = null;

        const { state, saveState } = await this.credentialsStore.getAuthState(
          whatsapp
        );

        const msgRetryCounterCache = new NodeCache();
        const userDevicesCache: CacheStore = new NodeCache();

        wsocket = makeWASocket({
          logger: loggerBaileys,
          printQRInTerminal: false,
          browser: Browsers.appropriate("Desktop"),
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
          },
          version,
          // @ts-ignore - syncHistory pode não estar tipado mas é suportado pelo Baileys
          syncHistory: {
            days: 5
          },
          msgRetryCounterCache,
          shouldIgnoreJid: jid => isJidBroadcast(jid)
        });

        wsocket.ev.on(
          "connection.update",
          async ({ connection, lastDisconnect, qr }) => {
            logger.info(
              `Socket  ${name} Connection Update ${connection || ""} ${
                lastDisconnect || ""
              }`
            );

            if (connection === "close") {
              if ((lastDisconnect?.error as Boom)?.output?.statusCode === 403) {
                await this.whatsappRepository.update(whatsapp, {
                  status: "PENDING",
                  session: ""
                });
                await this.baileysStore.delete(whatsapp.id);
                this.emitSessionUpdate(whatsapp.companyId, whatsapp);
                this.removeWbot(id, false);
                reject(new AppError("ERR_WAPP_FORBIDDEN"));
                return;
              }
              if (
                (lastDisconnect?.error as Boom)?.output?.statusCode !==
                DisconnectReason.loggedOut
              ) {
                this.removeWbot(id, false);
                setTimeout(
                  () =>
                    whatsappSessionService.start(whatsapp, whatsapp.companyId),
                  2000
                );
                // rejeição tardia (pós-resolve) é ignorada pela Promise; só
                // afeta o caso em que a conexão fecha antes de abrir
                reject(new AppError("ERR_WAPP_CONNECTION_CLOSED"));
              } else {
                await this.whatsappRepository.update(whatsapp, {
                  status: "PENDING",
                  session: ""
                });
                await this.baileysStore.delete(whatsapp.id);
                this.emitSessionUpdate(whatsapp.companyId, whatsapp);
                this.removeWbot(id, false);
                setTimeout(
                  () =>
                    whatsappSessionService.start(whatsapp, whatsapp.companyId),
                  2000
                );
                reject(new AppError("ERR_WAPP_LOGGED_OUT"));
              }
            }

            if (connection === "open") {
              this.retriesQrCodeMap.delete(id);
              await this.whatsappRepository.update(whatsapp, {
                status: "CONNECTED",
                qrcode: "",
                retries: 0
              });

              this.emitSessionUpdate(whatsapp.companyId, whatsapp);

              const sessionIndex = this.sessions.findIndex(
                s => s.id === whatsapp.id
              );
              if (sessionIndex === -1) {
                wsocket.id = whatsapp.id;
                this.sessions.push(wsocket);
              }

              resolve(wsocket);
            }

            if (qr !== undefined) {
              if (
                this.retriesQrCodeMap.get(id) &&
                this.retriesQrCodeMap.get(id) >= 3
              ) {
                await this.whatsappRepository.update(whatsappUpdate, {
                  status: "DISCONNECTED",
                  qrcode: ""
                });
                await this.baileysStore.delete(whatsappUpdate.id);
                this.emitSessionUpdate(whatsapp.companyId, whatsappUpdate);
                wsocket.ev.removeAllListeners("connection.update");
                wsocket.ws.close();
                const sessionIndex = this.sessions.findIndex(
                  s => s.id === whatsapp.id
                );
                if (sessionIndex !== -1) {
                  this.sessions.splice(sessionIndex, 1);
                }
                wsocket = null;
                this.retriesQrCodeMap.delete(id);
                reject(new AppError("ERR_WAPP_QRCODE_RETRIES_EXCEEDED"));
              } else {
                logger.info(`Session QRCode Generate ${name}`);
                this.retriesQrCodeMap.set(
                  id,
                  (this.retriesQrCodeMap.get(id) ?? 0) + 1
                );

                await this.whatsappRepository.update(whatsapp, {
                  qrcode: qr,
                  status: "qrcode",
                  retries: 0
                });
                const sessionIndex = this.sessions.findIndex(
                  s => s.id === whatsapp.id
                );

                if (sessionIndex === -1) {
                  wsocket.id = whatsapp.id;
                  this.sessions.push(wsocket);
                }

                this.emitSessionUpdate(whatsapp.companyId, whatsapp);
              }
            }
          }
        );
        wsocket.ev.on("creds.update", saveState);
      })().catch(error => {
        Sentry.captureException(error);
        logger.error(error);
        reject(error);
      });
    });
  }

  /** Evento `company-X-whatsappSession` no mainchannel (nomes inalterados). */
  private emitSessionUpdate(companyId: number, session: Whatsapp): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyWhatsappSession(companyId),
      {
        action: "update",
        session
      }
    );
  }
}

/**
 * Singleton do runtime de sessões — estado de processo único (arrays/mapas por
 * instância equivalem ao antigo estado de módulo de `libs/wbot.ts`).
 */
export const sessionManager = new SessionManager();
