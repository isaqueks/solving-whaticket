import { Router } from "express";

import isAuth from "../../shared/http/middleware/isAuth";
import { TagsController } from "./TagsController";

/**
 * Rotas do módulo Tags — mesmos paths/verbos do antigo `routes/tagRoutes.ts`.
 * Os handlers são arrow properties do controller (convenção do template B1),
 * então podem ser passados direto, sem `.bind`.
 */
const tagsRoutes = Router();
const tagsController = new TagsController();

tagsRoutes.get("/tags/list", isAuth, tagsController.list);

tagsRoutes.get("/tags", isAuth, tagsController.index);

tagsRoutes.get("/tags/kanban", isAuth, tagsController.kanban);

tagsRoutes.post("/tags", isAuth, tagsController.store);

tagsRoutes.put("/tags/:tagId", isAuth, tagsController.update);

tagsRoutes.get("/tags/:tagId", isAuth, tagsController.show);

tagsRoutes.delete("/tags/:tagId", isAuth, tagsController.remove);

tagsRoutes.post("/tags/sync", isAuth, tagsController.syncTags);

// Junção ticket↔tag (absorvida do antigo routes/ticketTagRoutes.ts na B2):
// paths/verbos idênticos aos originais. O domínio da tabela de junção pertence
// a Tags (model TicketTag mora aqui), por isso as rotas vivem neste arquivo.
tagsRoutes.put(
  "/ticket-tags/:ticketId/:tagId",
  isAuth,
  tagsController.storeTicketTag
);
tagsRoutes.delete(
  "/ticket-tags/:ticketId",
  isAuth,
  tagsController.removeTicketTags
);

export default tagsRoutes;
