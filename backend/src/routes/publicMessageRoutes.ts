import { Router } from "express";
import * as PublicMessageController from "../controllers/PublicMessageController";

const publicMessageRoutes = Router();

// Endpoint para enviar mensagem por número de telefone
// POST /public/messages/send-by-number
// Header: X-API-Auth: <PUBLIC_API_KEY>
// Body: { "to": "5511999999999", "content": "Sua mensagem aqui" }
publicMessageRoutes.post(
  "/public/messages/send-by-number",
  PublicMessageController.sendByNumber
);

export default publicMessageRoutes;
