import { Router } from "express";
import * as ContactWebhookController from "../controllers/ContactUpdateWebhookController";
import isAuth from "../middleware/isAuth";
import envTokenAuth from "../middleware/envTokenAuth";

const webhookRoutes = Router();

webhookRoutes.post("/contacts/sync", ContactWebhookController.index);

export default webhookRoutes;
