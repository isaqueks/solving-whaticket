import * as Sentry from "@sentry/node";
import { addSeconds, differenceInSeconds } from "date-fns";
import { isArray, isEmpty, isNil } from "lodash";
import moment from "moment";
import path from "path";
import { Op, QueryTypes } from "sequelize";
import sequelize from "../database";
import GetWhatsappWbot from "../helpers/GetWhatsappWbot";
import { getIO } from "../libs/socket";
import Campaign from "../models/Campaign";
import CampaignSetting from "../models/CampaignSetting";
import CampaignShipping from "../models/CampaignShipping";
import ContactList from "../models/ContactList";
import ContactListItem from "../models/ContactListItem";
import Whatsapp from "../models/Whatsapp";
import ShowFileService from "../services/FileServices/ShowService";
import { getMessageOptions } from "../services/WbotServices/SendWhatsAppMedia";
import { logger } from "../utils/logger";
import { campaignQueue } from "./connection";
import { randomValue } from "./lib";

interface ProcessCampaignData {
  id: number;
  delay: number;
}

interface PrepareContactData {
  contactId: number;
  campaignId: number;
  delay: number;
  variables: any[];
}

interface DispatchCampaignData {
  campaignId: number;
  campaignShippingId: number;
  contactListItemId: number;
}

// This module compiles to dist/queues/, so the backend's public folder is two
// levels up from __dirname (it was one level up in the old src/queues.ts).
const publicFolder = path.resolve(__dirname, "..", "..", "public");

async function getCampaign(id) {
  return await Campaign.findByPk(id, {
    include: [
      {
        model: ContactList,
        as: "contactList",
        attributes: ["id", "name"],
        include: [
          {
            model: ContactListItem,
            as: "contacts",
            attributes: ["id", "name", "number", "email", "isWhatsappValid"],
            where: { isWhatsappValid: true }
          }
        ]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name"]
      },
      {
        model: CampaignShipping,
        as: "shipping",
        include: [{ model: ContactListItem, as: "contact" }]
      }
    ]
  });
}

// Lightweight campaign fetch for per-contact jobs: only scalar fields +
// whatsapp are needed. Avoids eager-loading the full contact list and every
// CampaignShipping row on each of the thousands of jobs a campaign spawns.
async function getCampaignLite(id) {
  return await Campaign.findByPk(id, {
    include: [
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name"]
      }
    ]
  });
}

async function getContact(id) {
  return await ContactListItem.findByPk(id, {
    attributes: ["id", "name", "number", "email"]
  });
}

async function getSettings(campaign) {
  const settings = await CampaignSetting.findAll({
    where: { companyId: campaign.companyId },
    attributes: ["key", "value"]
  });

  let messageInterval: number = 20;
  let longerIntervalAfter: number = 20;
  let greaterInterval: number = 60;
  let variables: any[] = [];

  settings.forEach(setting => {
    if (setting.key === "messageInterval") {
      messageInterval = JSON.parse(setting.value);
    }
    if (setting.key === "longerIntervalAfter") {
      longerIntervalAfter = JSON.parse(setting.value);
    }
    if (setting.key === "greaterInterval") {
      greaterInterval = JSON.parse(setting.value);
    }
    if (setting.key === "variables") {
      variables = JSON.parse(setting.value);
    }
  });

  return {
    messageInterval,
    longerIntervalAfter,
    greaterInterval,
    variables
  };
}

function getCampaignValidMessages(campaign) {
  const messages = [];

  if (!isEmpty(campaign.message1) && !isNil(campaign.message1)) {
    messages.push(campaign.message1);
  }

  if (!isEmpty(campaign.message2) && !isNil(campaign.message2)) {
    messages.push(campaign.message2);
  }

  if (!isEmpty(campaign.message3) && !isNil(campaign.message3)) {
    messages.push(campaign.message3);
  }

  if (!isEmpty(campaign.message4) && !isNil(campaign.message4)) {
    messages.push(campaign.message4);
  }

  if (!isEmpty(campaign.message5) && !isNil(campaign.message5)) {
    messages.push(campaign.message5);
  }

  return messages;
}

function getCampaignValidConfirmationMessages(campaign) {
  const messages = [];

  if (
    !isEmpty(campaign.confirmationMessage1) &&
    !isNil(campaign.confirmationMessage1)
  ) {
    messages.push(campaign.confirmationMessage1);
  }

  if (
    !isEmpty(campaign.confirmationMessage2) &&
    !isNil(campaign.confirmationMessage2)
  ) {
    messages.push(campaign.confirmationMessage2);
  }

  if (
    !isEmpty(campaign.confirmationMessage3) &&
    !isNil(campaign.confirmationMessage3)
  ) {
    messages.push(campaign.confirmationMessage3);
  }

  if (
    !isEmpty(campaign.confirmationMessage4) &&
    !isNil(campaign.confirmationMessage4)
  ) {
    messages.push(campaign.confirmationMessage4);
  }

  if (
    !isEmpty(campaign.confirmationMessage5) &&
    !isNil(campaign.confirmationMessage5)
  ) {
    messages.push(campaign.confirmationMessage5);
  }

  return messages;
}

function getProcessedMessage(msg: string, variables: any[], contact: any) {
  let finalMessage = msg;

  if (finalMessage.includes("{nome}")) {
    finalMessage = finalMessage.replace(/{nome}/g, contact.name);
  }

  if (finalMessage.includes("{email}")) {
    finalMessage = finalMessage.replace(/{email}/g, contact.email);
  }

  if (finalMessage.includes("{numero}")) {
    finalMessage = finalMessage.replace(/{numero}/g, contact.number);
  }

  variables.forEach(variable => {
    if (finalMessage.includes(`{${variable.key}}`)) {
      const regex = new RegExp(`{${variable.key}}`, "g");
      finalMessage = finalMessage.replace(regex, variable.value);
    }
  });

  return finalMessage;
}

async function verifyAndFinalizeCampaign(campaign) {
  const count1 = await ContactListItem.count({
    where: {
      contactListId: campaign.contactListId,
      isWhatsappValid: true
    }
  });
  const count2 = await CampaignShipping.count({
    where: {
      campaignId: campaign.id,
      deliveredAt: {
        [Op.not]: null
      }
    }
  });

  if (count1 === count2) {
    await campaign.update({ status: "FINALIZADA", completedAt: moment() });
  }

  const io = getIO();
  io.to(`company-${campaign.companyId}-mainchannel`).emit(`company-${campaign.companyId}-campaign`, {
    action: "update",
    record: campaign
  });
}

function calculateDelay(index, baseDelay, longerIntervalAfter, greaterInterval, messageInterval) {
  const diffSeconds = differenceInSeconds(baseDelay, new Date());
  if (index > longerIntervalAfter) {
    return diffSeconds * 1000 + greaterInterval * 1000;
  }
  return diffSeconds * 1000 + messageInterval * 1000;
}

export async function handleVerifyCampaigns(job) {
  /**
   * @todo
   * Implementar filtro de campanhas
   */
  const campaigns: { id: number; scheduledAt: string }[] =
    await sequelize.query(
      `select id, "scheduledAt" from "Campaigns" c
    where "scheduledAt" between now() and now() + '1 hour'::interval and status = 'PROGRAMADA'`,
      { type: QueryTypes.SELECT }
    );

  if (campaigns.length > 0)
    logger.info(`Campanhas encontradas: ${campaigns.length}`);

  for (let campaign of campaigns) {
    try {
      const now = moment();
      const scheduledAt = moment(campaign.scheduledAt);
      const delay = scheduledAt.diff(now, "milliseconds");
      logger.info(
        `Campanha enviada para a fila de processamento: Campanha=${campaign.id}, Delay Inicial=${delay}`
      );
      campaignQueue.add(
        "ProcessCampaign",
        {
          id: campaign.id,
          delay
        },
        {
          removeOnComplete: true
        }
      );
    } catch (err: any) {
      Sentry.captureException(err);
    }
  }
}

export async function handleProcessCampaign(job) {
  try {
    const { id }: ProcessCampaignData = job.data;
    const campaign = await getCampaign(id);
    const settings = await getSettings(campaign);
    if (!campaign) {
      return;
    }
    // Idempotency guard: the verify poller enqueues a ProcessCampaign every
    // 20s while status stays PROGRAMADA. Flip the status before enqueuing the
    // per-contact jobs so a second run (or a concurrent tick) is skipped and
    // contacts are not dispatched twice.
    if (campaign.status !== "PROGRAMADA") {
      return;
    }
    await campaign.update({ status: "EM_ANDAMENTO" });
    const { contacts } = campaign.contactList;
    if (!isArray(contacts)) {
      return;
    }
    const contactData = contacts.map(contact => ({
      contactId: contact.id,
      campaignId: campaign.id,
      variables: settings.variables,
    }));

    // const baseDelay = job.data.delay || 0;
    // longerIntervalAfter is a message count (compared to the loop index);
    // greaterInterval/messageInterval are in seconds (used by addSeconds and
    // converted to ms inside calculateDelay). None must be pre-multiplied.
    const longerIntervalAfter = settings.longerIntervalAfter;
    const greaterInterval = settings.greaterInterval;
    const messageInterval = settings.messageInterval;

    let baseDelay = campaign.scheduledAt;

    const queuePromises = [];
    for (let i = 0; i < contactData.length; i++) {
      baseDelay = addSeconds(baseDelay, i > longerIntervalAfter ? greaterInterval : messageInterval);

      const { contactId, campaignId, variables } = contactData[i];
      const delay = calculateDelay(i, baseDelay, longerIntervalAfter, greaterInterval, messageInterval);
      const queuePromise = campaignQueue.add(
        "PrepareContact",
        { contactId, campaignId, variables, delay },
        { removeOnComplete: true }
      );
      queuePromises.push(queuePromise);
      logger.info(`Registro enviado pra fila de disparo: Campanha=${campaign.id};Contato=${contacts[i].name};delay=${delay}`);
    }
    await Promise.all(queuePromises);
  } catch (err: any) {
    Sentry.captureException(err);
  }
}

let ultima_msg = 0;
export async function handlePrepareContact(job) {
  try {
    const { contactId, campaignId, delay, variables }: PrepareContactData =
      job.data;
    const campaign = await getCampaignLite(campaignId);
    const contact = await getContact(contactId);

    const campaignShipping: any = {};
    campaignShipping.number = contact.number;
    campaignShipping.contactId = contactId;
    campaignShipping.campaignId = campaignId;

    const messages = getCampaignValidMessages(campaign);
    if (messages.length) {
      // ultima_msg is shared across all campaigns, so clamp against THIS
      // campaign's message count to avoid indexing an undefined message.
      const radomIndex = ultima_msg % messages.length;
      ultima_msg++;
      if (ultima_msg >= messages.length) {
        ultima_msg = 0;
      }
      const message = getProcessedMessage(
        messages[radomIndex],
        variables,
        contact
      );
      campaignShipping.message = `\u200c ${message}`;
    }

    if (campaign.confirmation) {
      const confirmationMessages =
        getCampaignValidConfirmationMessages(campaign);
      if (confirmationMessages.length) {
        const radomIndex = randomValue(0, confirmationMessages.length);
        const message = getProcessedMessage(
          confirmationMessages[radomIndex],
          variables,
          contact
        );
        campaignShipping.confirmationMessage = `\u200c ${message}`;
      }
    }

    const [record, created] = await CampaignShipping.findOrCreate({
      where: {
        campaignId: campaignShipping.campaignId,
        contactId: campaignShipping.contactId
      },
      defaults: campaignShipping
    });

    if (
      !created &&
      record.deliveredAt === null &&
      record.confirmationRequestedAt === null
    ) {
      record.set(campaignShipping);
      await record.save();
    }

    if (
      record.deliveredAt === null &&
      record.confirmationRequestedAt === null
    ) {
      const nextJob = await campaignQueue.add(
        "DispatchCampaign",
        {
          campaignId: campaign.id,
          campaignShippingId: record.id,
          contactListItemId: contactId
        },
        {
          delay
        }
      );

      await record.update({ jobId: nextJob.id });
    }

    await verifyAndFinalizeCampaign(campaign);
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`campaignQueue -> PrepareContact -> error: ${err.message}`);
  }
}

export async function handleDispatchCampaign(job) {
  try {
    const { data } = job;
    const { campaignShippingId, campaignId }: DispatchCampaignData = data;
    const campaign = await getCampaignLite(campaignId);
    const wbot = await GetWhatsappWbot(campaign.whatsapp);

    if (!wbot) {
      logger.error(`campaignQueue -> DispatchCampaign -> error: wbot not found`);
      return;
    }

    if (!campaign.whatsapp) {
      logger.error(`campaignQueue -> DispatchCampaign -> error: whatsapp not found`);
      return;
    }

    if (!wbot?.user?.id) {
      logger.error(`campaignQueue -> DispatchCampaign -> error: wbot user not found`);
      return;
    }

    logger.info(
      `Disparo de campanha solicitado: Campanha=${campaignId};Registro=${campaignShippingId}`
    );

    const campaignShipping = await CampaignShipping.findByPk(
      campaignShippingId,
      {
        include: [{ model: ContactListItem, as: "contact" }]
      }
    );

    const chatId = `${campaignShipping.number}@s.whatsapp.net`;

    let body = campaignShipping.message;

    if (campaign.confirmation && campaignShipping.confirmation === null) {
      body = campaignShipping.confirmationMessage
    }

    if (!isNil(campaign.fileListId)) {
      try {
        const files = await ShowFileService(campaign.fileListId, campaign.companyId)
        const folder = path.resolve(publicFolder, "fileList", String(files.id))
        for (const [index, file] of files.options.entries()) {
          const options = await getMessageOptions(file.path, path.resolve(folder, file.path), file.name);
          await wbot.sendMessage(chatId, { ...options });
        };
      } catch (error) {
        logger.info(error);
      }
    }

    if (campaign.mediaPath) {
      const filePath = path.join(publicFolder, campaign.mediaPath);

      const options = await getMessageOptions(campaign.mediaName, filePath, body);
      // getMessageOptions retorna null em caso de falha
      if (options && Object.keys(options).length) {
        await wbot.sendMessage(chatId, { ...options });
      }
    }
    else {
      if (campaign.confirmation && campaignShipping.confirmation === null) {
        await wbot.sendMessage(chatId, {
          text: body
        });
        await campaignShipping.update({ confirmationRequestedAt: moment() });
      } else {

        await wbot.sendMessage(chatId, {
          text: body
        });
      }
    }
    await campaignShipping.update({ deliveredAt: moment() });

    await verifyAndFinalizeCampaign(campaign);

    const io = getIO();
    io.to(`company-${campaign.companyId}-mainchannel`).emit(`company-${campaign.companyId}-campaign`, {
      action: "update",
      record: campaign
    });

    logger.info(
      `Campanha enviada para: Campanha=${campaignId};Contato=${campaignShipping.contact.name}`
    );
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(err.message);
    console.log(err.stack);
  }
}
