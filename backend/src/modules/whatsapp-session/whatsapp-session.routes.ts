import { Router } from "express";

import isAuth from "../../shared/http/middleware/isAuth";

import { WhatsappSessionController } from "./WhatsappSessionController";

const whatsappSessionRoutes = Router();
const whatsappSessionController = new WhatsappSessionController();

whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId",
  isAuth,
  whatsappSessionController.store
);

whatsappSessionRoutes.put(
  "/whatsappsession/:whatsappId",
  isAuth,
  whatsappSessionController.update
);

whatsappSessionRoutes.delete(
  "/whatsappsession/:whatsappId",
  isAuth,
  whatsappSessionController.remove
);

export default whatsappSessionRoutes;
