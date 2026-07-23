import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";

const tokenAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError("Invalid token", 401);
  }

  const [, token] = authHeader.split(" ");

  if (!token) {
    throw new AppError("Invalid token", 401);
  }

  const whatsapp = await Whatsapp.findOne({ where: { token } });

  if (!whatsapp) {
    throw new AppError("Invalid token", 401);
  }

  req.params.whatsappId = String(whatsapp.id);

  return next();
};

export default tokenAuth;
