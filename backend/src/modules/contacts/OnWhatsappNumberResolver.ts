import AppError from "../../shared/errors/AppError";
import { logger } from "../../utils/logger";
// Validação de número no runtime da sessão (grupo cíclico contacts ⇄
// whatsapp-session): usar o singleton apenas dentro do corpo dos métodos.
import { contactValidator } from "../whatsapp-session/ContactValidator";

/**
 * Variações BR de um número (com/sem o 9º dígito). Utilitário PURO, exportado
 * também para fora do módulo (ex.: PublicMessageController).
 */
export function getBrazilianNumberVariations(number: string): string[] {
  if (!number.startsWith("55")) {
    return [number];
  }

  if (number.length === 13) {
    const small = number.slice(0, 4) + number.slice(5);
    return [small, number];
  } else if (number.length === 12) {
    const big = number.slice(0, 4) + "9" + number.slice(4);
    return [number, big];
  }

  return [number];

}

const MAX_CACHE_SIZE = 5000;

// Cache em ESCOPO DE MÓDULO (não da instância): preserva exatamente a
// semântica do antigo `helpers/getOnWhatsappNumber.ts` — um único cache no
// processo, compartilhado por todos os chamadores, TTL infinito e eviction
// por ordem de inserção quando atinge o teto.
const cache = new Map<string, string>();

// Keeps the cache bounded. Maps preserve insertion order, so when the cap is
// reached we evict the oldest entry before inserting a new one.
function setCacheItem(key: string, value: string): void {
  if (!cache.has(key) && cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, value);
}

/**
 * Resolve o número canônico existente no WhatsApp (antigo
 * `getOnWhatsappNumber`). Lógica intocada — inclusive o retorno `null` quando
 * nenhuma variação existe e o log por variação que falhou.
 */
export class OnWhatsappNumberResolver {
  public async resolve(number: string, companyId: number): Promise<string> {

    const cacheKey = `${companyId}-${number}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const numbers = getBrazilianNumberVariations(number);

    for (const num of numbers) {
      try {
        const onWhatsapp = await contactValidator.checkNumber(num, companyId);
        if (!onWhatsapp?.exists || !onWhatsapp?.jid) {
          // Controle de fluxo interno: capturado pelo catch abaixo (só loga).
          throw new AppError("ERR_CHECK_NUMBER", 404);
        }
        const result = onWhatsapp?.jid.split("@")[0];
        setCacheItem(cacheKey, result);
        return result;
      }
      catch {
        logger.error(`Number ${num} not found on WhatsApp.`);
      }
    }

    return null;
  }
}
