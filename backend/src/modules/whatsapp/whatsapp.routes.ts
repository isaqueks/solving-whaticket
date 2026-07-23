import { Router } from "express";

import isAuth from "../../shared/http/middleware/isAuth";
import { WhatsappController } from "./WhatsappController";

/**
 * Rotas do módulo Whatsapp (CRUD de conexões) — mesmos paths/verbos do antigo
 * `routes/whatsappRoutes.ts`. As rotas de SESSÃO (start/disconnect) continuam
 * no `routes/whatsappSessionRoutes.ts` (B5), fora deste módulo.
 *
 * Os handlers são arrow properties do controller (convenção do template B1),
 * então podem ser passados direto, sem `.bind`.
 */
const whatsappRoutes = Router();
const whatsappController = new WhatsappController();

whatsappRoutes.get("/whatsapp/", isAuth, whatsappController.index);

whatsappRoutes.post("/whatsapp/", isAuth, whatsappController.store);

whatsappRoutes.get("/whatsapp/:whatsappId", isAuth, whatsappController.show);

whatsappRoutes.put("/whatsapp/:whatsappId", isAuth, whatsappController.update);

whatsappRoutes.delete(
  "/whatsapp/:whatsappId",
  isAuth,
  whatsappController.remove
);

export default whatsappRoutes;
