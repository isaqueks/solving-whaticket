import { Router } from "express";

import isAuth from "../../shared/http/middleware/isAuth";
import { SettingsController } from "./SettingsController";

/**
 * Rotas do módulo Settings — mesmos paths/verbos do antigo
 * `routes/settingRoutes.ts`. Os handlers são arrow properties do controller
 * (convenção do template B1), então podem ser passados direto, sem `.bind`.
 */
const settingsRoutes = Router();
const settingsController = new SettingsController();

settingsRoutes.get("/settings", isAuth, settingsController.index);

// change setting key to key in future
settingsRoutes.put(
  "/settings/:settingKey",
  isAuth,
  settingsController.update
);

export default settingsRoutes;
