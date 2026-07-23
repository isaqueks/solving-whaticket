import { Router } from "express";

import isAuth from "../../shared/http/middleware/isAuth";
import { ReportsController } from "./ReportsController";

/**
 * Rotas do módulo Reports — os paths permanecem `/dashboard/...`, idênticos ao
 * antigo `routes/dashboardRoutes.ts`, porque o frontend os chama por esses
 * nomes (o módulo se chama `reports`, mas o contrato HTTP não muda).
 *
 * `isAuth` em todas as rotas é o gate da rodada 1 — preservado exatamente. Os
 * handlers são arrow properties do controller (convenção do template B1),
 * então passam direto, sem `.bind`.
 */
const reportsRoutes = Router();
const reportsController = new ReportsController();

reportsRoutes.get("/dashboard", isAuth, reportsController.index);
reportsRoutes.get(
  "/dashboard/ticketsUsers",
  isAuth,
  reportsController.reportsUsers
);
reportsRoutes.get(
  "/dashboard/ticketsDay",
  isAuth,
  reportsController.reportsDay
);

export default reportsRoutes;
