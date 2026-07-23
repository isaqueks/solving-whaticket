import { Router } from "express";

import isAuth from "../../shared/http/middleware/isAuth";
import isSuper from "../../shared/http/middleware/isSuper";
import { PlansController } from "./PlansController";

/**
 * Rotas do módulo Plans — mesmos paths/verbos do antigo `routes/planRoutes.ts`.
 * Os handlers são arrow properties do controller (template B1), passados direto.
 *
 * `GET /plans/list` é PÚBLICO por decisão documentada (a tela de cadastro/preços
 * do signup consome os planos sem autenticação); `GET /plans/all` expõe a mesma
 * listagem com `isAuth`.
 */
const plansRoutes = Router();
const plansController = new PlansController();

plansRoutes.get("/plans", isAuth, plansController.index);

plansRoutes.get("/plans/list", plansController.list);

plansRoutes.get("/plans/all", isAuth, plansController.list);

plansRoutes.get("/plans/:id", isAuth, plansController.show);

plansRoutes.post("/plans", isAuth, isSuper, plansController.store);

plansRoutes.put("/plans/:id", isAuth, isSuper, plansController.update);

plansRoutes.delete("/plans/:id", isAuth, isSuper, plansController.remove);

export default plansRoutes;
