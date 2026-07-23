import { WASocket } from "baileys";

import { appConfig } from "../../config/AppConfig";
import { cacheLayer } from "../../libs/cache";
import { logger } from "../../utils/logger";

// O import abaixo participa do grupo cíclico tickets ⇄ whatsapp-session — usar
// o singleton SEMPRE dentro do corpo dos métodos (binding CommonJS lazy).
import { whatsappService } from "../whatsapp/WhatsappService";

import { sessionManager } from "./SessionManager";

const DEFAULT_PFP = `${appConfig.server.frontendUrl}/nopicture.png`;

/**
 * Foto de perfil de contatos (antigos `GetProfilePicUrl` e `GetCachedPFP`).
 * O `promiseMap` de deduplicação de fetches concorrentes virou estado da
 * instância do singleton — vida de processo idêntica ao estado de módulo
 * anterior, com a MESMA semântica (uma promise em voo por chave; remoção no
 * finally mesmo se o Redis falhar).
 */
export class ProfilePicService {
  private readonly promiseMap = new Map<string, Promise<any>>();

  /** URL da foto de perfil pela conexão padrão (antigo GetProfilePicUrl). */
  public async getProfilePicUrl(
    number: string,
    companyId: number
  ): Promise<string> {
    const defaultWhatsapp = await whatsappService.getDefaultWhatsApp(companyId);

    const wbot = sessionManager.getWbot(defaultWhatsapp.id);

    let profilePicUrl: string;
    try {
      profilePicUrl = await wbot.profilePictureUrl(`${number}@s.whatsapp.net`);
    } catch (error) {
      profilePicUrl = `${appConfig.server.frontendUrl}/nopicture.png`;
    }

    return profilePicUrl;
  }

  /**
   * Foto de perfil com cache Redis de 24h e corte de 500ms (antigo
   * getCachedPFP): se o fetch demorar, devolve o placeholder sem esperar.
   */
  public getCachedPFP(wbot: WASocket, waId: string): Promise<string> {
    return Promise.race([
      this.fetchCachedPFP(wbot, waId),
      new Promise<string>(resolve => {
        setTimeout(() => resolve(DEFAULT_PFP), 500);
      })
    ]);
  }

  private async fetchCachedPFP(wbot: WASocket, waId: string): Promise<string> {
    const REDIS_KEY = `pfp:${waId}`;

    const cached = await cacheLayer.get(REDIS_KEY);
    if (cached) {
      return cached;
    }

    let pfp: string = DEFAULT_PFP;
    if (!waId) {
      return pfp;
    }

    try {
      let promise = this.promiseMap.get(REDIS_KEY);
      if (!promise) {
        promise = wbot.profilePictureUrl(waId);
      }
      this.promiseMap.set(REDIS_KEY, promise);

      pfp = (await promise) || DEFAULT_PFP;
    } catch (err) {
      logger.error(`Failed to fetch pfp ${waId} (${REDIS_KEY}): ${err}`);
    }

    try {
      await cacheLayer.set(REDIS_KEY, pfp, "EX", 24 * 60 * 60); // Cache 24 hours
    } finally {
      // Sempre remove a promise do mapa, mesmo se o Redis falhar — caso
      // contrário o valor em memória ficaria congelado até reiniciar o processo
      this.promiseMap.delete(REDIS_KEY);
    }

    return pfp;
  }
}

/** Singleton — o promiseMap de dedup precisa ser único no processo. */
export const profilePicService = new ProfilePicService();
