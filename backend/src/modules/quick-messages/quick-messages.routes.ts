import { Router } from "express";
import multer from "multer";

import uploadConfig from "../../config/upload";
import isAuth from "../../shared/http/middleware/isAuth";
import { QuickMessagesController } from "./QuickMessagesController";

/**
 * Rotas do módulo QuickMessages — mesmos paths/verbos do antigo
 * `routes/quickMessageRoutes.ts`. Handlers são arrow properties do controller
 * (convenção do template B1), passados direto sem `.bind`.
 */
const upload = multer(uploadConfig);

const quickMessageRoutes = Router();
const quickMessagesController = new QuickMessagesController();

quickMessageRoutes.get(
  "/quick-messages/list",
  isAuth,
  quickMessagesController.findList
);

quickMessageRoutes.get("/quick-messages", isAuth, quickMessagesController.index);

quickMessageRoutes.get(
  "/quick-messages/:id",
  isAuth,
  quickMessagesController.show
);

quickMessageRoutes.post(
  "/quick-messages",
  isAuth,
  quickMessagesController.store
);

quickMessageRoutes.put(
  "/quick-messages/:id",
  isAuth,
  quickMessagesController.update
);

quickMessageRoutes.delete(
  "/quick-messages/:id",
  isAuth,
  quickMessagesController.remove
);

quickMessageRoutes.post(
  "/quick-messages/:id/media-upload",
  isAuth,
  upload.array("file"),
  quickMessagesController.mediaUpload
);

quickMessageRoutes.delete(
  "/quick-messages/:id/media-upload",
  isAuth,
  quickMessagesController.deleteMedia
);

export default quickMessageRoutes;
