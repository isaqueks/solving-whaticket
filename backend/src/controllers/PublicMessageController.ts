import { Request, Response } from "express";
import AppError from "../errors/AppError";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import formatBody from "../helpers/Mustache";

interface SendMessageBody {
  content: string;
}

/**
 * Envia mensagem para um contato identificado pelo taxId (CPF/CNPJ)
 * POST /public/messages/send-by-taxid/:taxId
 */
export const sendByTaxId = async (req: Request, res: Response): Promise<Response> => {
  const { taxId } = req.params;
  const { content }: SendMessageBody = req.body;

  if (!content) {
    throw new AppError("O campo 'content' é obrigatório", 400);
  }

  if (!taxId) {
    throw new AppError("O campo 'taxId' é obrigatório", 400);
  }

  // Busca o contato pelo taxId
  const contact = await Contact.findOne({
    where: { taxId }
  });

  if (!contact) {
    throw new AppError(`Contato com taxId '${taxId}' não encontrado`, 404);
  }

  // Busca a conexão WhatsApp padrão da empresa do contato
  const whatsapp = await GetDefaultWhatsApp(contact.companyId);

  if (!whatsapp) {
    throw new AppError("Nenhuma conexão WhatsApp disponível", 500);
  }

  // Encontra ou cria um ticket para o contato
  const ticket = await FindOrCreateTicketService(
    contact,
    whatsapp.id,
    0,
    contact.companyId
  );

  // Envia a mensagem
  await SendWhatsAppMessage({
    body: formatBody(content, contact),
    ticket,
    userId: null // Endpoint público, sem usuário autenticado
  });

  return res.status(200).json({
    success: true,
    message: "Mensagem enviada com sucesso",
    data: {
      contactId: contact.id,
      contactName: contact.name,
      ticketId: ticket.id
    }
  });
};

/**
 * Envia mensagem para um contato identificado pelo número de telefone
 * POST /public/messages/send-by-number/:number
 */
export const sendByNumber = async (req: Request, res: Response): Promise<Response> => {
  const { number } = req.params;
  const { content }: SendMessageBody = req.body;

  if (!content) {
    throw new AppError("O campo 'content' é obrigatório", 400);
  }

  if (!number) {
    throw new AppError("O campo 'number' é obrigatório", 400);
  }

  // Normaliza o número (remove caracteres não numéricos)
  const normalizedNumber = number.replace(/\D/g, "");

  // Busca o contato pelo número
  const contact = await Contact.findOne({
    where: { number: normalizedNumber }
  });

  if (!contact) {
    throw new AppError(`Contato com número '${number}' não encontrado`, 404);
  }

  // Busca a conexão WhatsApp padrão da empresa do contato
  const whatsapp = await GetDefaultWhatsApp(contact.companyId);

  if (!whatsapp) {
    throw new AppError("Nenhuma conexão WhatsApp disponível", 500);
  }

  // Encontra ou cria um ticket para o contato
  const ticket = await FindOrCreateTicketService(
    contact,
    whatsapp.id,
    0,
    contact.companyId
  );

  // Envia a mensagem
  await SendWhatsAppMessage({
    body: formatBody(content, contact),
    ticket,
    userId: null // Endpoint público, sem usuário autenticado
  });

  return res.status(200).json({
    success: true,
    message: "Mensagem enviada com sucesso",
    data: {
      contactId: contact.id,
      contactName: contact.name,
      ticketId: ticket.id
    }
  });
};

