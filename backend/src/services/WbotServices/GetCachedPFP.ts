import { WASocket } from "baileys";
import { cacheLayer } from "../../libs/cache";


export async function getCachedPFP(wbot: WASocket, waId: string): Promise<string> {
  const REDIS_KEY = `pfp:${waId}`;
  const cached = await cacheLayer.get(REDIS_KEY);
  if (cached) {
    return cached;
  }

  let pfp: string = `${process.env.FRONTEND_URL}/nopicture.png`;
  if (!waId) {
    return pfp;
  }

  try {
    console.log(`Fetching profile picture for waId: ${waId} (${REDIS_KEY})`);
    pfp = (await wbot.profilePictureUrl(waId)) || pfp;
  }
  catch (err) {
    console.error(`Failed do fetch pfp ${waId} (${REDIS_KEY})`, err);
  }
  finally {
    console.log(`Got pfp ${waId} = ${pfp}`)
  }

  await cacheLayer.set(REDIS_KEY, pfp, 'EX', 24 * 60 * 60); // Cache 24 hours
  console.log(`Cache set ${REDIS_KEY}`);
  return pfp;
}