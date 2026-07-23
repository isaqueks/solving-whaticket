import { Router } from "express";
import multer from "multer";

import uploadConfig from "../../config/upload";
import isAuth from "../../shared/http/middleware/isAuth";
import { ContactListItemsController } from "./ContactListItemsController";
import { ContactListsController } from "./ContactListsController";

/**
 * Rotas do módulo ContactLists — mesmos paths/verbos dos antigos
 * `routes/contactListRoutes.ts` e `routes/contactListItemRoutes.ts`, reunidos
 * aqui.
 *
 * Um único arquivo para os dois sub-recursos: ContactLists é dona dos seus
 * itens (os models moram juntos em `modules/contact-lists/models/`),
 * espelhando o que Queues fez com QueueOptions. Um único mount em
 * `routes/index.ts` substitui os dois anteriores.
 *
 * Handlers são arrow properties dos controllers (convenção do template B1),
 * passados direto sem `.bind`.
 */
const upload = multer(uploadConfig);

const contactListRoutes = Router();
const contactListsController = new ContactListsController();
const contactListItemsController = new ContactListItemsController();

// ── ContactLists (listas de contatos) ───────────────────────────────────────
// `/list` antes de `/:id` para não ser capturado pela rota paramétrica.
contactListRoutes.get(
  "/contact-lists/list",
  isAuth,
  contactListsController.findList
);

contactListRoutes.get("/contact-lists", isAuth, contactListsController.index);

contactListRoutes.get(
  "/contact-lists/:id",
  isAuth,
  contactListsController.show
);

contactListRoutes.post("/contact-lists", isAuth, contactListsController.store);

contactListRoutes.post(
  "/contact-lists/:id/upload",
  isAuth,
  upload.array("file"),
  contactListsController.upload
);

contactListRoutes.put(
  "/contact-lists/:id",
  isAuth,
  contactListsController.update
);

contactListRoutes.delete(
  "/contact-lists/:id",
  isAuth,
  contactListsController.remove
);

// ── ContactListItems (contatos de cada lista) ────────────────────────────────
contactListRoutes.get(
  "/contact-list-items/list",
  isAuth,
  contactListItemsController.findList
);

contactListRoutes.get(
  "/contact-list-items",
  isAuth,
  contactListItemsController.index
);

contactListRoutes.get(
  "/contact-list-items/:id",
  isAuth,
  contactListItemsController.show
);

contactListRoutes.post(
  "/contact-list-items",
  isAuth,
  contactListItemsController.store
);

contactListRoutes.put(
  "/contact-list-items/:id",
  isAuth,
  contactListItemsController.update
);

contactListRoutes.delete(
  "/contact-list-items/:id",
  isAuth,
  contactListItemsController.remove
);

export default contactListRoutes;
