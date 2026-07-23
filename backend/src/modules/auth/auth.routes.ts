import { Router } from "express";

import envTokenAuth from "../../shared/http/middleware/envTokenAuth";
import isAuth from "../../shared/http/middleware/isAuth";
import { UsersController } from "../users/UsersController";
import { AuthController } from "./AuthController";

/**
 * Rotas do módulo Auth — mesmos paths/verbos do antigo `routes/authRoutes.ts`
 * (montadas sob o prefixo "/auth" em routes/index.ts).
 *
 * POST /signup pertence ao domínio Users (criação de usuário por token de
 * ambiente) e segue apontando para o UsersController — só a montagem vive
 * aqui, como no arquivo original.
 */
const authRoutes = Router();
const authController = new AuthController();
const usersController = new UsersController();

authRoutes.post("/signup", envTokenAuth, usersController.store);

authRoutes.post("/login", authController.store);

authRoutes.post("/refresh_token", authController.update);

authRoutes.delete("/logout", isAuth, authController.remove);

authRoutes.get("/me", isAuth, authController.me);

export default authRoutes;
