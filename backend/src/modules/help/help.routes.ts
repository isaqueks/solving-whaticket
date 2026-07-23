import { Router } from "express";

import isAuth from "../../shared/http/middleware/isAuth";
import isSuper from "../../shared/http/middleware/isSuper";
import { HelpController } from "./HelpController";

/**
 * Rotas do módulo Help — mesmos paths/verbos/middlewares do antigo
 * `routes/helpRoutes.ts`. Os handlers são arrow properties do controller
 * (convenção do template B1), então podem ser passados direto, sem `.bind`.
 */
const helpRoutes = Router();
const helpController = new HelpController();

helpRoutes.get("/helps/list", isAuth, helpController.findList);

helpRoutes.get("/helps", isAuth, helpController.index);

helpRoutes.get("/helps/:id", isAuth, helpController.show);

helpRoutes.post("/helps", isAuth, isSuper, helpController.store);

helpRoutes.put("/helps/:id", isAuth, isSuper, helpController.update);

helpRoutes.delete("/helps/:id", isAuth, isSuper, helpController.remove);

export default helpRoutes;
