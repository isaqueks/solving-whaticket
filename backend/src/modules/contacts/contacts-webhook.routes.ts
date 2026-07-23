import { Router } from "express";

import contactSyncAuth from "../../shared/http/middleware/contactSyncAuth";
import { ContactsController } from "./ContactsController";

/**
 * Webhook custom do dono (antigo `routes/webhookRoutes.ts`) — montado sob o
 * prefixo "/webhook" no routes/index.ts, como antes. Rota, verbo e o
 * middleware contactSyncAuth são CONGELADOS.
 */
const contactsWebhookRoutes = Router();
const contactsController = new ContactsController();

contactsWebhookRoutes.post(
  "/contacts/sync",
  contactSyncAuth,
  contactsController.syncWebhook
);

export default contactsWebhookRoutes;
