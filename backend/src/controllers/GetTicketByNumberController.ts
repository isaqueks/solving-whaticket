import { Request, Response } from "express";
import Ticket from "../models/Ticket";
import { Op } from "sequelize";
import CreateTicketService from "../services/TicketServices/CreateTicketService";
import Contact from "../models/Contact";
import User from "../models/User";


export class GetTickerByNumberController {

  public async get(req: Request, res: Response) {
    const { phone } = req.query;
    if (typeof phone !== 'string' || !/^\+?[1-9]\d{1,14}$/.test(phone)) {
      return res.status(400).json({ error: "Phone number is required" });
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
      return res.status(400).json({ error: "Contact not found" });
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
        status: 'pending',
        companyId,
        userId: user.id,
      });
    }

    res.status(200).json(ticket);

  }

}