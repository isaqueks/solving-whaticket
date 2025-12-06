import { Request, Response } from "express";
import AppError from "../errors/AppError";
import Contact from "../models/Contact";
import { getWbot } from "../libs/wbot";
import ListGroupParticipantsService from "../services/GroupParticipantServices/ListGroupParticipantsService";
import SyncGroupParticipantsService from "../services/GroupParticipantServices/SyncGroupParticipantsService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const contact = await Contact.findOne({
    where: { id: contactId, companyId }
  });

  if (!contact) {
    throw new AppError("Contato não encontrado", 404);
  }

  const participants = await ListGroupParticipantsService({
    contactId: parseInt(contactId)
  });

  return res.json(participants);
};

export const sync = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const { force } = req.query;

  const contact = await Contact.findOne({
    where: { id: contactId, companyId }
  });

  if (!contact) {
    throw new AppError("Contato não encontrado", 404);
  }

  if (!contact.isGroup) {
    throw new AppError("O contato não é um grupo", 400);
  }

  // Obtém a conexão WhatsApp
  const wbot = getWbot(contact.whatsappId);

  const participants = await SyncGroupParticipantsService({
    contactId: parseInt(contactId),
    wbot,
    forceSync: force === "true"
  });

  return res.json(participants);
};

