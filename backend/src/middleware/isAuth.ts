import { verify } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";
import authConfig from "../config/auth";
import User from "../models/User";

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number;
  iat: number;
  exp: number;
}

const isAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const solvingUserId = req.cookies['userId'];

  if (!solvingUserId) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const solvingUserResponse = await fetch(process.env.CHECK_AUTH_ENDPOINT, {
    headers: {
      'Cookie': `userId=${solvingUserId}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3 TKCHAT'
    }
  });
  if (!solvingUserResponse.ok) {
    logger.error(`Failed to verify user ID: ${solvingUserId}`);
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const userData = await solvingUserResponse.json();
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

  // const [, token] = solvingUserId.split(" ");

  // try {
  //   const decoded = verify(token, authConfig.secret);
  //   const { id, profile, companyId } = decoded as TokenPayload;
  //   req.user = {
  //     id,
  //     profile,
  //     companyId
  //   };
  // } catch (err) {
  //   console.error(err);
  //   throw new AppError("Invalid token. We'll try to assign a new one on next request", 403 );
  // }

  return next();
};

export default isAuth;
