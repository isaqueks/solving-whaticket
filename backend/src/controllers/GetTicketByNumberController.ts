import { Request, Response } from "express";
import Ticket from "../models/Ticket";
import { Op } from "sequelize";
import CreateTicketService from "../services/TicketServices/CreateTicketService";
import Contact from "../models/Contact";
import User from "../models/User";
import CheckContactNumber from "../services/WbotServices/CheckNumber";

const numExistCache = new Map<string, boolean>();
async function checkValid(num: string, cpId: number): Promise<boolean> {
  if (numExistCache.has(num)) {
    return numExistCache.get(num);
  }

  try {
    const valid = await CheckContactNumber(num, cpId);
    numExistCache.set(num, valid.exists);
    return valid.exists;
  }
  catch (err) {
    if (err.message.includes("ERR_CHECK_NUMBER")) {
      numExistCache.set(num, false);
      return false;
    }
    throw err;
  }
}

export class GetTickerByNumberController {


  public async get(req: Request, res: Response) {
    const { phone } = req.query;
    if (typeof phone !== 'string' || !/^\+?[1-9]\d{1,14}$/.test(phone)) {
      return res.status(200).json({ error: "Phone number is required" });
    }

    const { companyId } = req.user;

    const numRegex = /^(55[0-9][0-9])9([0-9]{8})$/;

    const contact = await Contact.findOne({
      where: {
        number: numRegex.test(phone) ? {
          [Op.or]: [phone.replace(numRegex, "$1$2"), phone]
        } : phone,
        companyId: companyId
      }
    });
    if (!contact) {
      // let exist;
      // if (GetTickerByNumberController.numExistCache.has(phone)) {
      //   exist = GetTickerByNumberController.numExistCache.get(phone);
      // }
      // else {
      //   exist = 
      // }
      const nums = numRegex.test(phone) ? [phone.replace(numRegex, "$1$2"), phone] : [phone];
      let exist = false;
      for (const num of nums) {
        exist = await checkValid(num, companyId);
        if (exist) break;
      }

      if (!exist) {
        return res.status(200).json({ error: "Número inválido" });
      }

      return res.status(200).json({ error: "Contact not found" });
    }

    let ticket = await Ticket.findOne({
      where: {
        contactId: contact.id,
        companyId: companyId
      }
    });

    let user = await User.findOne({
      where: {
        id: req.user.id
      }
    });

    if (contact.attachedToEmail) {
      const foundUser = await User.findOne({
        where: {
          companyId,
          email: contact.attachedToEmail
        }
      });

      if (foundUser) {
        user = foundUser;
      }
    }

    if (!ticket) {
      ticket = await CreateTicketService({
        contactId: contact.id,
        status: 'closed',
        companyId,
        userId: user.id,
      });
    }

    res.status(200).json(ticket);

  }

}