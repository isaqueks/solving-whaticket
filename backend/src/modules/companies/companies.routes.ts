import { Router } from "express";

import isAuth from "../../shared/http/middleware/isAuth";
import isSuper from "../../shared/http/middleware/isSuper";
import { CompaniesController } from "./CompaniesController";

/**
 * Rotas do módulo Companies — mesmos paths/verbos do antigo
 * `routes/companyRoutes.ts`. Os handlers são arrow properties do controller
 * (template B1), passados direto, sem `.bind`.
 *
 * `POST /companies/cadastro` é PÚBLICO (a página de Signup usa esse endpoint) —
 * decisão preservada. Os guards `isSuper` de gestão ficam idênticos aos antigos.
 */
const companiesRoutes = Router();
const companiesController = new CompaniesController();

companiesRoutes.get(
  "/companies/list",
  isAuth,
  isSuper,
  companiesController.list
);
companiesRoutes.get("/companies", isAuth, isSuper, companiesController.index);
companiesRoutes.get("/companies/:id", isAuth, companiesController.show);
companiesRoutes.post("/companies", isAuth, isSuper, companiesController.store);
companiesRoutes.put(
  "/companies/:id",
  isAuth,
  isSuper,
  companiesController.update
);
companiesRoutes.put(
  "/companies/:id/schedules",
  isAuth,
  companiesController.updateSchedules
);
companiesRoutes.delete(
  "/companies/:id",
  isAuth,
  isSuper,
  companiesController.remove
);
companiesRoutes.post("/companies/cadastro", companiesController.store);

// Rota para listar o plano da empresa
companiesRoutes.get(
  "/companies/listPlan/:id",
  isAuth,
  companiesController.listPlan
);
companiesRoutes.get("/companiesPlan", isAuth, companiesController.indexPlan);

export default companiesRoutes;
