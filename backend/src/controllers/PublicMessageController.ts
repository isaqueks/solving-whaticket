import { Request, Response } from "express";
import { Op } from "sequelize";
import AppError from "../errors/AppError";
import Contact from "../models/Contact";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import { getBrazilianNumberVariations } from "../helpers/getOnWhatsappNumber";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import formatBody from "../helpers/Mustache";
import { getWbot } from "../libs/wbot";
import { getContactJid } from "../helpers/getContactJid";

interface SendMessageBody {
  to: string;
  content: string;
}

/**
 * Valida o header X-API-Auth
 */
const validateApiAuth = (req: Request): void => {
  const apiKey = req.headers["x-api-auth"];
  const expectedKey = process.env.PUBLIC_API_KEY;

  if (!expectedKey) {
    throw new AppError("API key não configurada no servidor", 500);
  }

  if (!apiKey) {
    throw new AppError("Header 'X-API-Auth' é obrigatório", 401);
  }

  if (apiKey !== expectedKey) {
    throw new AppError("API key inválida", 401);
  }
};

/**
 * Envia mensagem para um contato identificado pelo número de telefone
 * POST /public/messages/send-by-number
 * Header: X-API-Auth
 * Body: { to: string, content: string }
 */
export const sendByNumber = async (req: Request, res: Response): Promise<Response> => {
  // Valida autenticação via header
  validateApiAuth(req);

  const { to, content }: SendMessageBody = req.body;

  if (!content) {
    throw new AppError("O campo 'content' é obrigatório", 400);
  }

  if (!to) {
    throw new AppError("O campo 'to' é obrigatório", 400);
  }

  // Normaliza o número (remove caracteres não numéricos)
  const normalizedNumber = to.replace(/\D/g, "");

  // Gera variações do número brasileiro (com/sem 9)
  const numberVariations = getBrazilianNumberVariations(normalizedNumber);

  // Busca o contato por qualquer variação do número
  const contact = await Contact.findOne({
    where: {
      number: { [Op.in]: numberVariations }
    }
  });

  if (!contact) {
    throw new AppError(`Contato com número '${to}' não encontrado`, 404);
  }

  // Busca a conexão WhatsApp padrão da empresa do contato
  const whatsapp = await GetDefaultWhatsApp(contact.companyId);

  if (!whatsapp) {
    throw new AppError("Nenhuma conexão WhatsApp disponível", 500);
  }

  const wbot = getWbot(whatsapp.id);

  await wbot.sendMessage(getContactJid(contact), { text: content });

  return res.status(200).json({
    success: true,
    message: "Mensagem enviada com sucesso",
    data: {
      contactId: contact.id,
      contactName: contact.name,
    }
  });
};
