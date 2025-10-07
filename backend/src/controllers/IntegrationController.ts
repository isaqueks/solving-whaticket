import { Request, Response } from "express";
import Whatsapp from "../models/Whatsapp";
import { SendMessage } from "../helpers/SendMessage";
import GetWhatsappWbot from "../helpers/GetWhatsappWbot";

type Body = {
  to: string;
  message: string;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const body = req.body as Body;

  const whats = await Whatsapp.findOne({
    where: {
      status: 'CONNECTED'
    }
  });

  if (!whats) {
    return res.status(400).json({
      error: 'No WhatsApp connected'
    });
  }

  const wbot = await GetWhatsappWbot(whats);
  if (!wbot) {
    return res.status(400).json({
      error: 'WhatsApp not found'
    });
  }

  await wbot.sendMessage(body.to, {
    text: body.message,
  });

  return res.json({
    success: true
  })
};