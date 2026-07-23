import { Router } from "express";
import multer from "multer";

import uploadConfig from "../../config/upload";
import isAuth from "../../shared/http/middleware/isAuth";
import isSuper from "../../shared/http/middleware/isSuper";
import { AnnouncementsController } from "./AnnouncementsController";

/**
 * Rotas do módulo Announcements — mesmos paths/verbos e guards (isAuth/isSuper)
 * do antigo `routes/announcementRoutes.ts`. Handlers são arrow properties do
 * controller (convenção do template B1), passados direto sem `.bind`.
 */
const upload = multer(uploadConfig);

const announcementRoutes = Router();
const announcementsController = new AnnouncementsController();

announcementRoutes.get(
  "/announcements/list",
  isAuth,
  announcementsController.findList
);

announcementRoutes.get(
  "/announcements",
  isAuth,
  announcementsController.index
);

announcementRoutes.get(
  "/announcements/:id",
  isAuth,
  announcementsController.show
);

announcementRoutes.post(
  "/announcements",
  isAuth,
  isSuper,
  announcementsController.store
);

announcementRoutes.put(
  "/announcements/:id",
  isAuth,
  isSuper,
  announcementsController.update
);

announcementRoutes.delete(
  "/announcements/:id",
  isAuth,
  isSuper,
  announcementsController.remove
);

announcementRoutes.post(
  "/announcements/:id/media-upload",
  isAuth,
  isSuper,
  upload.array("file"),
  announcementsController.mediaUpload
);

announcementRoutes.delete(
  "/announcements/:id/media-upload",
  isAuth,
  isSuper,
  announcementsController.deleteMedia
);

export default announcementRoutes;
