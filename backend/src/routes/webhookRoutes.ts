import { Router } from "express";
import * as ContactWebhookController from "../controllers/ContactUpdateWebhookController";
import contactSyncAuth from "../middleware/contactSyncAuth";

const webhookRoutes = Router();

webhookRoutes.post(
  "/contacts/sync",
  contactSyncAuth,
  ContactWebhookController.index
);

export default webhookRoutes;
