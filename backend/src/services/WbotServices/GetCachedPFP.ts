import { WASocket } from "baileys";
import { cacheLayer } from "../../libs/cache";


export async function getCachedPFP(wbot: WASocket, waId: string): Promise<string> {
  const REDIS_KEY = `pfp:${waId}`;
  const cached = await cacheLayer.get(REDIS_KEY);
  if (cached) {
    return cached;
  }

  let pfp: string = `${process.env.FRONTEND_URL}/nopicture.png`;

  try {
    console.log(`Fetching profile picture for waId: ${waId}`);
    pfp = await wbot.profilePictureUrl(waId);
  }
  catch {}
  console.log('Fetched PFP END');

  await cacheLayer.set(REDIS_KEY, pfp, 'EX', 1 * 60 * 60); // Cache 1 hour
  return pfp;
}