import { Router } from "express";
import multer from "multer";

import uploadConfig from "../../config/upload";
import isAuth from "../../shared/http/middleware/isAuth";
import { SchedulesController } from "./SchedulesController";

/**
 * Rotas do módulo Schedules — mesmos paths/verbos do antigo
 * `routes/scheduleRoutes.ts`. Os handlers são arrow properties do controller
 * (convenção do template B1), então podem ser passados direto, sem `.bind`.
 */
const upload = multer(uploadConfig);

const schedulesRoutes = Router();
const schedulesController = new SchedulesController();

schedulesRoutes.get("/schedules", isAuth, schedulesController.index);

schedulesRoutes.post("/schedules", isAuth, schedulesController.store);

schedulesRoutes.put(
  "/schedules/:scheduleId",
  isAuth,
  schedulesController.update
);

schedulesRoutes.get("/schedules/:scheduleId", isAuth, schedulesController.show);

schedulesRoutes.delete(
  "/schedules/:scheduleId",
  isAuth,
  schedulesController.remove
);

schedulesRoutes.post(
  "/schedules/:id/media-upload",
  isAuth,
  upload.array("file"),
  schedulesController.mediaUpload
);

schedulesRoutes.delete(
  "/schedules/:id/media-upload",
  isAuth,
  schedulesController.deleteMedia
);

export default schedulesRoutes;
