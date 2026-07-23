import { Router } from "express";
import multer from "multer";

import uploadConfig from "../../config/upload";
import isAuth from "../../shared/http/middleware/isAuth";
import { ContactsController } from "./ContactsController";

/**
 * Rotas do módulo Contacts — mesmos paths/verbos do antigo
 * `routes/contactRoutes.ts`. Fix da migração: POST /contacts/upload era
 * registrado (por engano) no router de contactListRoutes importado; agora
 * vive no router do próprio domínio — path, verbo e middlewares idênticos.
 */
const contactsRoutes = Router();
const contactsController = new ContactsController();

const upload = multer(uploadConfig);

contactsRoutes.post(
  "/contacts/import",
  isAuth,
  contactsController.importPhone
);

contactsRoutes.post(
  "/contacts/upload",
  isAuth,
  upload.array("file"),
  contactsController.upload
);

contactsRoutes.get("/contacts", isAuth, contactsController.index);

contactsRoutes.get("/contacts/list", isAuth, contactsController.list);

contactsRoutes.get("/contacts/:contactId", isAuth, contactsController.show);

contactsRoutes.post("/contacts", isAuth, contactsController.store);

contactsRoutes.put("/contacts/:contactId", isAuth, contactsController.update);

contactsRoutes.delete("/contacts/:contactId", isAuth, contactsController.remove);

contactsRoutes.get("/contact", isAuth, contactsController.getContactVcard);

export default contactsRoutes;
