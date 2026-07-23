import { Router } from "express";
import multer from "multer";

import uploadConfig from "../../config/upload";
import isAuth from "../../shared/http/middleware/isAuth";
import tokenAuth from "../../shared/http/middleware/tokenAuth";
import { MessagesController } from "./MessagesController";

/**
 * Rotas do módulo Messages — mesmos paths/verbos/middlewares do antigo
 * `routes/messageRoutes.ts` (incluindo o POST /api/messages/send com
 * tokenAuth, contrato da API externa).
 */
const messagesRoutes = Router();
const messagesController = new MessagesController();

const upload = multer(uploadConfig);

messagesRoutes.post("/messages/forward", isAuth, messagesController.forward);
messagesRoutes.get("/messages/:ticketId", isAuth, messagesController.index);
messagesRoutes.post(
  "/messages/:ticketId",
  isAuth,
  upload.array("medias"),
  messagesController.store
);
messagesRoutes.delete(
  "/messages/:messageId",
  isAuth,
  messagesController.remove
);
messagesRoutes.post(
  "/api/messages/send",
  tokenAuth,
  upload.array("medias"),
  messagesController.send
);

export default messagesRoutes;
