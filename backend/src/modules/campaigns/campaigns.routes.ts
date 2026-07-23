import express from "express";
import multer from "multer";

import uploadConfig from "../../config/upload";
import isAuth from "../../shared/http/middleware/isAuth";
import { CampaignsController } from "./CampaignsController";
import { CampaignSettingsController } from "./CampaignSettingsController";

/**
 * Rotas do módulo Campaigns — mesmos paths/verbos dos antigos
 * `routes/campaignRoutes.ts` e `routes/campaignSettingRoutes.ts`, reunidos
 * aqui (as configurações são parte do agregado de campanhas; um único mount
 * em `routes/index.ts` substitui os dois anteriores).
 *
 * Handlers são arrow properties dos controllers (convenção do template B1),
 * passados direto sem `.bind`.
 */
const upload = multer(uploadConfig);

const campaignRoutes = express.Router();
const campaignsController = new CampaignsController();
const campaignSettingsController = new CampaignSettingsController();

// ── Campanhas ────────────────────────────────────────────────────────────────

campaignRoutes.get("/campaigns/list", isAuth, campaignsController.findList);

campaignRoutes.get("/campaigns", isAuth, campaignsController.index);

campaignRoutes.get("/campaigns/:id", isAuth, campaignsController.show);

campaignRoutes.post("/campaigns", isAuth, campaignsController.store);

campaignRoutes.put("/campaigns/:id", isAuth, campaignsController.update);

campaignRoutes.delete("/campaigns/:id", isAuth, campaignsController.remove);

campaignRoutes.post("/campaigns/:id/cancel", isAuth, campaignsController.cancel);

campaignRoutes.post(
  "/campaigns/:id/restart",
  isAuth,
  campaignsController.restart
);

campaignRoutes.post(
  "/campaigns/:id/media-upload",
  isAuth,
  upload.array("file"),
  campaignsController.mediaUpload
);

campaignRoutes.delete(
  "/campaigns/:id/media-upload",
  isAuth,
  campaignsController.deleteMedia
);

// ── Configurações de campanha ───────────────────────────────────────────────

campaignRoutes.get(
  "/campaign-settings",
  isAuth,
  campaignSettingsController.index
);

campaignRoutes.post(
  "/campaign-settings",
  isAuth,
  campaignSettingsController.store
);

export default campaignRoutes;
