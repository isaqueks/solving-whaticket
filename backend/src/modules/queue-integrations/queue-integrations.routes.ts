import { Router } from "express";

import isAuth from "../../shared/http/middleware/isAuth";
import { IntegrationsController } from "./IntegrationsController";
import { QueueIntegrationsController } from "./QueueIntegrationsController";

/**
 * Rotas do módulo QueueIntegrations — mesmos paths/verbos dos antigos
 * `routes/queueIntegrationRoutes.ts` e `routes/integrationRoutes.ts`,
 * reunidos aqui (um único mount em `routes/index.ts` substitui os dois).
 *
 * Handlers são arrow properties dos controllers (convenção do template B1),
 * passados direto sem `.bind`.
 */
const queueIntegrationRoutes = Router();
const queueIntegrationsController = new QueueIntegrationsController();
const integrationsController = new IntegrationsController();

// ── CRUD de integrações (tela de configuração) ──────────────────────────────

queueIntegrationRoutes.get(
  "/queueIntegration",
  isAuth,
  queueIntegrationsController.index
);

queueIntegrationRoutes.post(
  "/queueIntegration",
  isAuth,
  queueIntegrationsController.store
);

queueIntegrationRoutes.get(
  "/queueIntegration/:integrationId",
  isAuth,
  queueIntegrationsController.show
);

queueIntegrationRoutes.put(
  "/queueIntegration/:integrationId",
  isAuth,
  queueIntegrationsController.update
);

queueIntegrationRoutes.delete(
  "/queueIntegration/:integrationId",
  isAuth,
  queueIntegrationsController.remove
);

// ── Integração externa (kill switch — ver IntegrationsController) ───────────
// SEM isAuth, como no arquivo original.

queueIntegrationRoutes.post(
  "/integrationRoutes",
  integrationsController.index
);

export default queueIntegrationRoutes;
