import axios from "axios";
import { logger } from "../../utils/logger";

/**
 * Notifica o sistema de inadimplência que houve contato com um cliente via
 * WhatsApp, atualizando a `lastContactDate` das inadimplências vinculadas ao
 * telefone.
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
const onlyDigits = (value: string): string => (value || "").replace(/\D/g, "");
const wait = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const NotifyWppReceiveMessage = async (phone: string): Promise<void> => {
  const url = process.env.WPP_RECEIVE_MESSAGE_URL;
  const token = process.env.WPP_RECEIVE_MESSAGE_TOKEN;

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
};

export default NotifyWppReceiveMessage;
