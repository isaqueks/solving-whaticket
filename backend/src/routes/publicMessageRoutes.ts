import { Router } from "express";
import * as PublicMessageController from "../controllers/PublicMessageController";

const publicMessageRoutes = Router();

// Endpoint para enviar mensagem por taxId (CPF/CNPJ)
// POST /public/messages/send-by-taxid/:taxId
// Body: { "content": "Sua mensagem aqui" }
publicMessageRoutes.post(
  "/public/messages/send-by-taxid/:taxId",
  PublicMessageController.sendByTaxId
);

// Endpoint para enviar mensagem por número de telefone
// POST /public/messages/send-by-number/:number
// Body: { "content": "Sua mensagem aqui" }
publicMessageRoutes.post(
  "/public/messages/send-by-number/:number",
  PublicMessageController.sendByNumber
);

export default publicMessageRoutes;

