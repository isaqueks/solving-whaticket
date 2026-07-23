import { Request, Response, NextFunction } from "express";

import { appConfig } from "../../../config/AppConfig";
import AppError from "../../errors/AppError";
import { logger } from "../../../utils/logger";

type TokenPayload = {
  token: string | undefined;
};

const envTokenAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { token: bodyToken } = req.body as TokenPayload;
    const { token: queryToken } = req.query as TokenPayload;

    if (queryToken === appConfig.auth.envToken) {
      return next();
    }

    if (bodyToken === appConfig.auth.envToken) {
      return next();
    }
  } catch (e) {
    // Falha ao ler token do body/query — segue para a rejeição 403 abaixo.
    logger.error({ err: e }, "envTokenAuth: falha ao extrair token da requisição");
  }

  throw new AppError("Token inválido", 403);
};

export default envTokenAuth;
