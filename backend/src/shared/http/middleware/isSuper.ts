import { Request, Response, NextFunction } from "express";

import AppError from "../../errors/AppError";
import User from "../../../modules/users/models/User";

const isSuper = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = await User.findByPk(req.user.id);
  if (!user) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  if (!user.super) {
    throw new AppError("Acesso não permitido", 401);
  }

  return next();
};

export default isSuper;
