import { Router } from "express";

import isAuth from "../../shared/http/middleware/isAuth";
import { UsersController } from "./UsersController";

/**
 * Rotas do módulo Users — mesmos paths/verbos do antigo `routes/userRoutes.ts`.
 * Os handlers são arrow properties do controller (convenção do template B1),
 * então podem ser passados direto, sem `.bind`.
 *
 * A rota POST /signup (criação por token de ambiente) continua no
 * `modules/auth/auth.routes.ts`, apontando para `usersController.store`.
 */
const userRoutes = Router();
const usersController = new UsersController();

userRoutes.get("/users", isAuth, usersController.index);

userRoutes.get("/users/list", isAuth, usersController.list);

userRoutes.post("/users", isAuth, usersController.store);

userRoutes.put("/users/:userId", isAuth, usersController.update);

userRoutes.get("/users/:userId", isAuth, usersController.show);

userRoutes.delete("/users/:userId", isAuth, usersController.remove);

export default userRoutes;
