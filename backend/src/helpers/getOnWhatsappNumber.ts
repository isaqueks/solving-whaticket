import CheckContactNumber from "../services/WbotServices/CheckNumber";

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

export async function getOnWhatsappNumber(
  number: string,
  companyId: number
): Promise<string> {

  const cacheKey = `${companyId}-${number}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const numbers = getBrazilianNumberVariations(number);

  for (const num of numbers) {
    try {
      const onWhatsapp = await CheckContactNumber(num, companyId);
      if (!onWhatsapp?.exists || !onWhatsapp?.jid) {
        throw new Error(`Contact with number ${number} does not exist on WhatsApp.`);
      }
      const result = onWhatsapp?.jid.split("@")[0];
      setCacheItem(cacheKey, result);
      return result;
    }
    catch {
      console.log(`Number ${num} not found on WhatsApp.`);
    }
  }

  return null;
}