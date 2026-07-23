import { WASocket } from "baileys";
import { cacheLayer } from "../../libs/cache";
import { logger } from "../../utils/logger";

const DEFAULT_PFP = `${process.env.FRONTEND_URL}/nopicture.png`;

const promiseMap = new Map<string, Promise<any>>();

async function _getCachedPFP(wbot: WASocket, waId: string): Promise<string> {
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
    let promise = promiseMap.get(REDIS_KEY);
    if (!promise) {
      promise = wbot.profilePictureUrl(waId);
    }
    promiseMap.set(REDIS_KEY, promise);

    pfp = (await promise) || DEFAULT_PFP;
  } catch (err) {
    logger.error(`Failed to fetch pfp ${waId} (${REDIS_KEY}): ${err}`);
  }

  try {
    await cacheLayer.set(REDIS_KEY, pfp, "EX", 24 * 60 * 60); // Cache 24 hours
  } finally {
    // Sempre remove a promise do mapa, mesmo se o Redis falhar — caso
    // contrário o valor em memória ficaria congelado até reiniciar o processo
    promiseMap.delete(REDIS_KEY);
  }

  return pfp;
}

export function getCachedPFP(wbot: WASocket, waId: string): Promise<string> { 
  return Promise.race([
    _getCachedPFP(wbot, waId),
    new Promise<string>((resolve, reject) => {
      setTimeout(() => resolve(DEFAULT_PFP), 500);
    })
  ]);
}