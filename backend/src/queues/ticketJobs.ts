import * as Sentry from "@sentry/node";
import { QueryTypes } from "sequelize";
import sequelize from "../database";
import Company from "../models/Company";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import User from "../models/User";
import CreateTicketService from "../services/TicketServices/CreateTicketService";
import { attachAllTicketsToUser } from "../services/WbotServices/attachAllTicketsToUser";
import { ClosedAllOpenTickets } from "../services/WbotServices/wbotClosedTickets";
import { logger } from "../utils/logger";

const CronJob = require('cron').CronJob;

async function handleAttachTickets() {
  const job = new CronJob('*/10 * * * *', async () => {
    const companies = await Company.findAll();
    for (const c of companies) {
      try {
        const companyId = c.id;
        await attachAllTicketsToUser(companyId);
      } catch (e: any) {
        Sentry.captureException(e);
        logger.error("attachAllTicketsToUser -> Verify: error", e.message);
      }
    }
  });
  job.start()
}

async function handleCloseTicketsAutomatic() {
  const job = new CronJob('*/3 * * * *', async () => {
    const companies = await Company.findAll();
    for (const c of companies) {
      try {
        const companyId = c.id;
        await ClosedAllOpenTickets(companyId);
      } catch (e: any) {
        Sentry.captureException(e);
        logger.error("ClosedAllOpenTickets -> Verify: error", e.message);
      }
    }
  });
  job.start()
}

const userByEmailCache = new Map<string, User>();

const getUserByEmail = async (email: string): Promise<User> => {
  if (userByEmailCache.has(email)) {
    return userByEmailCache.get(email);
  }

  const user = await User.findOne({ where: { email } });
  if (user) {
    userByEmailCache.set(email, user);
  }

  return user;
}

async function handleCreateTicketAutomatic() {
  const job = new CronJob('*/10 * * * *', async () => {
    const contacts = await sequelize.query(/*sql*/`
    SELECT
      c.id as id,
      c."companyId" as "companyId",
      c."attachedToEmail" as "attachedToEmail"
    FROM
      "${Contact.tableName}" c
    WHERE
      c.id NOT IN (
        SELECT DISTINCT t."contactId" FROM "${Ticket.tableName}" t
      ) AND
      c."attachedToEmail" IS NOT NULL
  `, {
      type: QueryTypes.SELECT
    }) as any[];

    for (const c of contacts) {
      const user = await getUserByEmail(c.attachedToEmail);
      if (!user) {
        continue;
      }

      await CreateTicketService({
        contactId: c.id,
        status: 'closed',
        companyId: c.companyId,
        userId: user.id,
      });
    }
  });
  job.start();
}

// Module-level bootstrap: these CronJob-based sweeps run only on the main
// instance and start as soon as this module is loaded (via the queues barrel),
// exactly as they did in the old monolithic queues.ts.
if (process.env.PORT === process.env.MAIN_PORT) {
  handleCloseTicketsAutomatic();

  handleAttachTickets();

  handleCreateTicketAutomatic();
}
