import { Request, Response } from "express";
import Ticket from "../models/Ticket";
import { Op } from "sequelize";
import CreateTicketService from "../services/TicketServices/CreateTicketService";
import Contact from "../models/Contact";
import User from "../models/User";
import CheckContactNumber from "../services/WbotServices/CheckNumber";

const NUM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const NUM_CACHE_MAX_SIZE = 5000;

const numExistCache = new Map<string, { exists: boolean; timestamp: number }>();

function pruneNumCache() {
  const now = Date.now();
  for (const [key, value] of numExistCache) {
    if ((now - value.timestamp) >= NUM_CACHE_TTL) {
      numExistCache.delete(key);
    }
  }

  // Hard cap: if still over the limit, evict oldest (insertion-ordered) entries.
  if (numExistCache.size > NUM_CACHE_MAX_SIZE) {
    const excess = numExistCache.size - NUM_CACHE_MAX_SIZE;
    let removed = 0;
    for (const key of numExistCache.keys()) {
      if (removed >= excess) break;
      numExistCache.delete(key);
      removed += 1;
    }
  }
}

async function checkValid(num: string, cpId: number): Promise<boolean> {
  const cached = numExistCache.get(num);
  if (cached && (Date.now() - cached.timestamp) < NUM_CACHE_TTL) {
    return cached.exists;
  }
  if (cached) {
    numExistCache.delete(num);
  }

  try {
    const valid = await CheckContactNumber(num, cpId);
    numExistCache.set(num, { exists: valid.exists, timestamp: Date.now() });
    pruneNumCache();
    return valid.exists;
  }
  catch (err) {
    if (err.message.includes("ERR_CHECK_NUMBER")) {
      numExistCache.set(num, { exists: false, timestamp: Date.now() });
      pruneNumCache();
      return false;
    }
    throw err;
  }
}

export class GetTicketByNumberController {


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