import axios from "axios";

import { appConfig } from "../../config/AppConfig";
import { logger } from "../../utils/logger";

/**
 * Notifica o sistema de inadimplência que houve contato com um cliente via
 * WhatsApp, atualizando a `lastContactDate` das inadimplências vinculadas ao
 * telefone (antigo `WbotServices/NotifyWppReceiveMessage.ts`).
 *
 * INTEGRAÇÃO DO DONO — COMPORTAMENTO CONGELADO: dedup, timeout e retries são
 * idênticos ao original; o Map de deduplicação virou estado da instância do
 * singleton (vida de processo, exatamente como o estado de módulo anterior).
 *
 * Antes esse endpoint era acionado internamente pelo próprio sistema de
 * inadimplência (a partir do webhook de mensagens do WhatsApp). Agora é o
 * whaticket (sistema externo) que chama o endpoint diretamente, enviando apenas
 * o telefone do contato.
 *
 * Endpoint alvo: `POST <WPP_RECEIVE_MESSAGE_URL>` (ex.:
 * `https://<host>/api/webhooks/wppReceiveMessage`), autenticado pelo header
 * `X-Webhook-Token` (segredo compartilhado, `WPP_RECEIVE_MESSAGE_TOKEN`).
 *
 * A chamada é "best effort": qualquer falha é apenas logada, nunca propagada,
 * para não interferir no processamento da mensagem.
 */

interface WppReceiveMessageResponse {
  success: boolean;
  contactFound?: boolean;
  updatedRows?: number;
  message?: string;
}

const REQUEST_TIMEOUT_MS = 10000;
const MAX_ATTEMPTS = 3;

// Janela de deduplicação por telefone. Como o endpoint apenas atualiza a
// `lastContactDate`, notificar uma vez por telefone dentro dessa janela é
// suficiente. Isso evita disparar milhares de requisições HTTP concorrentes
// (ex.: campanhas cujos envios ecoam como mensagens `fromMe`, uma por contato),
// que esgotariam sockets/descritores e martelariam o serviço externo.
const DEDUP_WINDOW_MS = appConfig.wpp.receiveMessageDedupMs;

const onlyDigits = (value: string): string => (value || "").replace(/\D/g, "");
const wait = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export class LastContactNotifier {
  private readonly lastNotifiedAt = new Map<string, number>();

  public async notify(phone: string): Promise<void> {
    const url = appConfig.wpp.receiveMessageUrl;
    const token = appConfig.wpp.receiveMessageToken;

    // Integração não configurada: não há para onde notificar, então ignora.
    if (!url || !token) {
      return;
    }

    // O endpoint remove caracteres não numéricos, mas já normalizamos aqui para
    // evitar enviar telefones obviamente vazios/inválidos.
    const normalizedPhone = onlyDigits(phone);
    if (!normalizedPhone) {
      return;
    }

    // Deduplicação/debounce por telefone: se já notificamos esse número dentro da
    // janela, não dispara outra requisição. Marcamos o horário ANTES da chamada
    // para também barrar o fan-out de invocações concorrentes do mesmo telefone.
    const now = Date.now();
    if (DEDUP_WINDOW_MS > 0) {
      const previous = this.lastNotifiedAt.get(normalizedPhone);
      if (previous !== undefined && now - previous < DEDUP_WINDOW_MS) {
        return;
      }
      this.lastNotifiedAt.set(normalizedPhone, now);

      // Poda entradas expiradas para o Map não crescer indefinidamente.
      if (this.lastNotifiedAt.size > 10000) {
        this.lastNotifiedAt.forEach((ts, key) => {
          if (now - ts >= DEDUP_WINDOW_MS) {
            this.lastNotifiedAt.delete(key);
          }
        });
      }
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const { data } = await axios.post<WppReceiveMessageResponse>(
          url,
          { phone: normalizedPhone },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Webhook-Token": token
            },
            timeout: REQUEST_TIMEOUT_MS
          }
        );

        // 2xx: requisição processada. contactFound:false / updatedRows:0 é um
        // no-op válido (não é erro e não deve ser retentado).
        logger.info(
          `[wppReceiveMessage] phone=${normalizedPhone} contactFound=${data?.contactFound} updatedRows=${data?.updatedRows}`
        );
        return;
      } catch (err: any) {
        const status: number | undefined = err?.response?.status;

        // 4xx (400 telefone ausente, 401 token inválido, etc.): erro de
        // requisição/configuração. Retentar não resolve, então desiste.
        if (status && status < 500) {
          logger.error(
            `[wppReceiveMessage] erro não-retentável phone=${normalizedPhone} status=${status} body=${JSON.stringify(
              err?.response?.data
            )}`
          );
          return;
        }

        // Erro de transporte (sem status) ou 5xx: aceitável retentar.
        logger.warn(
          `[wppReceiveMessage] tentativa ${attempt}/${MAX_ATTEMPTS} falhou phone=${normalizedPhone} status=${status ??
            "network"} msg=${err?.message}`
        );

        if (attempt === MAX_ATTEMPTS) {
          logger.error(
            `[wppReceiveMessage] desistindo após ${MAX_ATTEMPTS} tentativas phone=${normalizedPhone}`
          );
          return;
        }

        await wait(500 * attempt);
      }
    }
  }
}

/** Singleton — o Map de dedup precisa ser único no processo (como antes). */
export const lastContactNotifier = new LastContactNotifier();
