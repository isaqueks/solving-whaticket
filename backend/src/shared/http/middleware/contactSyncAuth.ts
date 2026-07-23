import { Request, Response, NextFunction } from "express";

import { appConfig } from "../../../config/AppConfig";
import AppError from "../../errors/AppError";
import { logger } from "../../../utils/logger";

type TokenPayload = {
  token?: string;
};

let warnedMissingEnv = false;

const contactSyncAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const expectedToken = appConfig.auth.contactSyncToken;

  if (!expectedToken) {
    if (!warnedMissingEnv) {
      warnedMissingEnv = true;
      logger.warn(
        "CONTACT_SYNC_TOKEN not set – /webhook/contacts/sync is unauthenticated"
      );
    }
    return next();
  }

  const headerToken = req.headers["x-webhook-token"] as string | undefined;
  const { token: bodyToken } = req.body as TokenPayload;
  const { token: queryToken } = req.query as TokenPayload;

  const providedToken = headerToken || bodyToken || queryToken;

  if (providedToken === expectedToken) {
    return next();
  }

  throw new AppError("Invalid token", 403);
};

export default contactSyncAuth;
