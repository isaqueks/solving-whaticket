import { Router } from "express";

import { PublicMessagesController } from "./PublicMessagesController";

/**
 * Rotas públicas do módulo Messages — mesmo path/verbo do antigo
 * `routes/publicMessageRoutes.ts`.
 *
 * POST /public/messages/send-by-number
 * Header: X-API-Auth: <PUBLIC_API_KEY>
 * Body: { "to": "5511999999999", "content": "Sua mensagem aqui" }
 */
const publicMessagesRoutes = Router();
const publicMessagesController = new PublicMessagesController();

publicMessagesRoutes.post(
  "/public/messages/send-by-number",
  publicMessagesController.sendByNumber
);

export default publicMessagesRoutes;
