import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import User from "../models/User";

const isSuper = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const user = await User.findByPk(req.user.id);
  if (!user) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
  const { super: isSuper } = user;
  if(!isSuper){
    throw new AppError(
      "Acesso não permitido",
      401
    );
  }

  return next();
}

export default isSuper;
