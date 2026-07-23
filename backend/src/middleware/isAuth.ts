import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";
import User from "../models/User";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
const CACHE_MAX_SIZE = 5000;

const cache: Map<string, {
  user: any,
  timestamp: number
}> = new Map();

function pruneCache() {
  const now = Date.now();
  for (const [key, value] of cache) {
    if ((now - value.timestamp) >= CACHE_TTL) {
      cache.delete(key);
    }
  }

  // Hard cap: if still over the limit, evict oldest (insertion-ordered) entries.
  if (cache.size > CACHE_MAX_SIZE) {
    const excess = cache.size - CACHE_MAX_SIZE;
    let removed = 0;
    for (const key of cache.keys()) {
      if (removed >= excess) break;
      cache.delete(key);
      removed += 1;
    }
  }
}

export async function fetchUserData(userId: string) {
  if (cache.has(userId)) {
    const cachedData = cache.get(userId);
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
      return cachedData.user;
    }
    // Expired: remove so stale entries don't accumulate.
    cache.delete(userId);
  }

  const response = await fetch(process.env.CHECK_AUTH_ENDPOINT, {
    headers: {
      'Cookie': `user=${userId}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3 TKCHAT'
    }
  });

  if (!response.ok) {
   return null;
  }

  const userData = await response.json();
  cache.set(userId, { user: userData, timestamp: Date.now() });
  pruneCache();

  return userData;
}

const isAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const solvingUserId = req.cookies['user'];
  if (!solvingUserId) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const userData = await fetchUserData(solvingUserId);
  if (!userData) {
    logger.error(`No user data found for ID: ${solvingUserId}`);
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  if (userData.blocked) {
    logger.error(`User ID ${solvingUserId} is blocked.`);
    throw new AppError("ERR_USER_BLOCKED", 403);
  }

  const systemUser = await User.findOne({
    where: {
      email: userData.email,
    }
  });

  if (!systemUser) {
    logger.error(`No user found with email: ${userData.email}`);
    throw new AppError("ERR_USER_NOT_FOUND", 404);
  }

  req.user = {
    id: String(systemUser.id),
    profile: systemUser.profile,
    companyId: systemUser.companyId
  };

  return next();
};

export default isAuth;
