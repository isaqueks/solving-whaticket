import { head, isNil } from "lodash";
import moment from "moment";
import path from "path";

import { proto, WAMessage } from "baileys";

import formatBody from "../../helpers/Mustache";
import { getContactJid } from "../../helpers/getContactJid";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import QueueIntegrations from "../../models/QueueIntegrations";
import QueueOption from "../../models/QueueOption";
import Setting from "../../models/Setting";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import typebotListener from "../TypebotServices/typebotListener";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { getMessageOptions } from "./SendWhatsAppMedia";
import { Session } from "./types";
import { getBodyMessage, getTypeMessage } from "./wbotMessageParser";
import { verifyMediaMessage, verifyMessage } from "./wbotMessagePersistence";

const request = require("request");

/**
 * Verifica se a fila está fora do horário de expediente configurado para o dia
 * de hoje. Retorna false quando não há expediente configurado para hoje ou
 * quando a fila não tem mensagem de fora de expediente (comportamento
 * idêntico aos três blocos inline que esta função substituiu).
 */
export const isOutsideQueueSchedule = (queue: Queue): boolean => {
  if (isNil(queue.outOfHoursMessage) || queue.outOfHoursMessage === "") {
    return false;
  }

  const { schedules }: any = queue;
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return false;
  }

  const now = moment();
  const weekday = now.format("dddd").toLowerCase();
  const schedule = schedules.find(
    s =>
      s.weekdayEn === weekday &&
      s.startTime !== "" &&
      s.startTime !== null &&
      s.endTime !== "" &&
      s.endTime !== null
  );

  if (isNil(schedule)) {
    return false;
  }

  const startTime = moment(schedule.startTime, "HH:mm");
  const endTime = moment(schedule.endTime, "HH:mm");

  return now.isBefore(startTime) || now.isAfter(endTime);
};

export const handleMessageIntegration = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  queueIntegration: QueueIntegrations,
  ticket: Ticket
): Promise<void> => {
  const msgType = getTypeMessage(msg);

  if (queueIntegration.type === "n8n" || queueIntegration.type === "webhook") {
    if (!queueIntegration?.urlN8N) return;

    const options = {
      method: "POST",
      url: queueIntegration?.urlN8N,
      headers: {
        "Content-Type": "application/json"
      },
      json: msg
    };
    request(options, function (error, response) {
      if (error) {
        // Um throw aqui viraria exceção não capturada (callback assíncrono)
        logger.error(
          `Erro ao chamar integração ${queueIntegration.type} (${queueIntegration?.urlN8N}): ${error}`
        );
      } else {
        logger.debug(response.body);
      }
    });
    return;
  }

  if (queueIntegration.type === "typebot") {
    await typebotListener({ ticket, msg, wbot, typebot: queueIntegration });
  }
}

export const verifyQueue = async (
  wbot: Session,
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact
) => {
  const companyId = ticket.companyId;

  const { queues, greetingMessage, maxUseBotQueues, timeUseBotQueues } = await ShowWhatsAppService(
    wbot.id!,
    ticket.companyId
  )



  if (queues.length === 1) {

    const sendGreetingMessageOneQueues = await Setting.findOne({
      where: {
        key: "sendGreetingMessageOneQueues",
        companyId: ticket.companyId
      }
    });

    if (greetingMessage.length > 1 && sendGreetingMessageOneQueues?.value === "enabled") {
      const body = formatBody(`${greetingMessage}`, contact);

      await wbot.sendMessage(getContactJid(contact),
        {
          text: body
        }
      );
    }

    const firstQueue = head(queues);
    let chatbot = false;
    if (firstQueue?.options) {
      chatbot = firstQueue.options.length > 0;
    }


    //inicia integração dialogflow/n8n
    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !isNil(queues[0]?.integrationId)
    ) {
      const integrations = await ShowQueueIntegrationService(queues[0].integrationId, companyId);

      await handleMessageIntegration(msg, wbot, integrations, ticket)

      await ticket.update({
        useIntegration: true,
        integrationId: integrations.id
      })
      // return;
    }

    await UpdateTicketService({
      ticketData: { queueId: firstQueue.id, chatbot, status: "pending" },
      ticketId: ticket.id,
      companyId: ticket.companyId,
    });

    return;
  }

  const selectedOption = getBodyMessage(msg);
  const choosenQueue = queues[+selectedOption - 1];

  const buttonActive = await Setting.findOne({
    where: {
      key: "chatBotType",
      companyId
    }
  });



  /**
   * recebe as mensagens dos usuários e envia as opções de fila
   * tratamento de mensagens para resposta aos usuarios apartir do chatbot/fila.
   */
  const botText = async () => {
    let options = "";

    queues.forEach((queue, index) => {
      options += `*[ ${index + 1} ]* - ${queue.name}\n`;
    });


    const textMessage = {
      text: formatBody(`\u200e${greetingMessage}\n\n${options}`, contact),
    };
    const lastMsg = await Message.findOne({
      where: {
        remoteJid: `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
        fromMe: true
      },
      order: [["createdAt", "DESC"]],
      limit: 1
    })
    let invalidOption = "Opção inválida, por favor, escolha uma opção válida."

    if (!lastMsg || getBodyMessage(msg).includes('#') || lastMsg.body !== textMessage.text) {
      const sendMsg = await wbot.sendMessage(getContactJid(contact),
        textMessage
      );
      await verifyMessage(sendMsg, ticket, ticket.contact);

    } else if (lastMsg.body !== invalidOption) {
      textMessage.text = invalidOption
      const sendMsg = await wbot.sendMessage(getContactJid(contact),
        textMessage
      );
      await verifyMessage(sendMsg, ticket, ticket.contact);
    }

  };

  if (choosenQueue) {
    let chatbot = false;
    if (choosenQueue?.options) {
      chatbot = choosenQueue.options.length > 0;
    }

    await UpdateTicketService({
      ticketData: { queueId: choosenQueue.id, chatbot },
      ticketId: ticket.id,
      companyId: ticket.companyId,
    });


    /* Tratamento para envio de mensagem quando a fila está fora do expediente */
    if (choosenQueue.options.length === 0) {
      const queue = await Queue.findByPk(choosenQueue.id);

      if (isOutsideQueueSchedule(queue)) {
          const body = formatBody(`\u200e ${queue.outOfHoursMessage}\n\n*[ # ]* - Voltar ao Menu Principal`, ticket.contact);
          const sentMessage = await wbot.sendMessage(getContactJid(contact), {
            text: body,
          }
          );
          await verifyMessage(sentMessage, ticket, contact);
          await UpdateTicketService({
            ticketData: { queueId: null, chatbot },
            ticketId: ticket.id,
            companyId: ticket.companyId,
          });
          return;
      }

      //inicia integração dialogflow/n8n
      if (
        !msg.key.fromMe &&
        !ticket.isGroup &&
        choosenQueue.integrationId
      ) {
        const integrations = await ShowQueueIntegrationService(choosenQueue.integrationId, companyId);

        await handleMessageIntegration(msg, wbot, integrations, ticket)

        await ticket.update({
          useIntegration: true,
          integrationId: integrations.id
        })
        // return;
      }

      const body = formatBody(`\u200e${choosenQueue.greetingMessage}`, ticket.contact
      );
      if (choosenQueue.greetingMessage) {
        const sentMessage = await wbot.sendMessage(getContactJid(contact), {
          text: body,
        });
        await verifyMessage(sentMessage, ticket, contact);
      }
      if (choosenQueue.mediaPath !== null && choosenQueue.mediaPath !== "") {
        const filePath = path.resolve("public", choosenQueue.mediaPath);

        const optionsMsg = await getMessageOptions(choosenQueue.mediaName, filePath);

        let sentMessage = await wbot.sendMessage(getContactJid(ticket.contact), { ...optionsMsg });

        await verifyMediaMessage(sentMessage, ticket, contact);
      }
    }

  } else {

    if (maxUseBotQueues && maxUseBotQueues !== 0 && ticket.amountUsedBotQueues >= maxUseBotQueues) {
      // await UpdateTicketService({
      //   ticketData: { queueId: queues[0].id },
      //   ticketId: ticket.id
      // });

      return;
    }

    //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
    const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
    let dataLimite = new Date();
    let Agora = new Date();


    if (ticketTraking.chatbotAt !== null) {
      dataLimite.setMinutes(ticketTraking.chatbotAt.getMinutes() + (Number(timeUseBotQueues)));

      if (ticketTraking.chatbotAt !== null && Agora < dataLimite && timeUseBotQueues !== "0" && ticket.amountUsedBotQueues !== 0) {
        return
      }
    }
    await ticketTraking.update({
      chatbotAt: null
    })

    if (buttonActive.value === "text") {
      return botText();
    }

  }

};

export const handleChartbot = async (ticket: Ticket, msg: WAMessage, wbot: Session, dontReadTheFirstQuestion: boolean = false) => {



  const queue = await Queue.findByPk(ticket.queueId, {
    include: [
      {
        model: QueueOption,
        as: "options",
        where: { parentId: null },
        order: [
          ["option", "ASC"],
          ["createdAt", "ASC"],
        ],
      },
    ],
  });




  const messageBody = getBodyMessage(msg);


  if (messageBody == "#") {
    // voltar para o menu inicial
    await ticket.update({ queueOptionId: null, chatbot: false, queueId: null });
    await verifyQueue(wbot, msg, ticket, ticket.contact);
    return;
  }

  // voltar para o menu anterior
  if (!isNil(queue) && !isNil(ticket.queueOptionId) && messageBody == "0") {
    const option = await QueueOption.findByPk(ticket.queueOptionId);
    await ticket.update({ queueOptionId: option?.parentId });

    // escolheu uma opção
  } else if (!isNil(queue) && !isNil(ticket.queueOptionId)) {


    const count = await QueueOption.count({
      where: { parentId: ticket.queueOptionId },
    });
    let option: any = {};
    if (count == 1) {
      option = await QueueOption.findOne({
        where: { parentId: ticket.queueOptionId },
      });
    } else {
      option = await QueueOption.findOne({
        where: {
          option: messageBody || "",
          parentId: ticket.queueOptionId,
        },
      });
    }
    if (option) {
      await ticket.update({ queueOptionId: option?.id });
    }

    // não linha a primeira pergunta
  } else if (!isNil(queue) && isNil(ticket.queueOptionId) && !dontReadTheFirstQuestion) {
    const option = queue?.options.find((o) => o.option == messageBody);
    if (option) {
      await ticket.update({ queueOptionId: option?.id });
    }
  }

  await ticket.reload();

  if (!isNil(queue) && isNil(ticket.queueOptionId)) {


    const queueOptions = await QueueOption.findAll({
      where: { queueId: ticket.queueId, parentId: null },
      order: [
        ["option", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    const companyId = ticket.companyId;

    const buttonActive = await Setting.findOne({
      where: {
        key: "chatBotType",
        companyId
      }
    });

    const botButton = async () => {
      const buttons = [];
      queueOptions.forEach((option, i) => {
        buttons.push({
          buttonId: `${option.option}`,
          buttonText: { displayText: option.title },
          type: 4
        });
      });
      buttons.push({
        buttonId: `#`,
        buttonText: { displayText: "Menu inicial *[ 0 ]* Menu anterior" },
        type: 4
      });

      const buttonMessage = {
        text: formatBody(`\u200e${queue.greetingMessage}`, ticket.contact),
        buttons,
        headerType: 4
      };

      const sendMsg = await wbot.sendMessage(getContactJid(ticket.contact),
        buttonMessage
      );

      await verifyMessage(sendMsg, ticket, ticket.contact);
    }

    const botText = async () => {
      let options = "";

      queueOptions.forEach((option, i) => {
        options += `*[ ${option.option} ]* - ${option.title}\n`;
      });
      //options += `\n*[ 0 ]* - Menu anterior`;
      options += `\n*[ # ]* - Menu inicial`;

      const textMessage = {
        text: formatBody(`\u200e${queue.greetingMessage}\n\n${options}`, ticket.contact),
      };

      const sendMsg = await wbot.sendMessage(getContactJid(ticket.contact), textMessage);

      await verifyMessage(sendMsg, ticket, ticket.contact);
    };

    if (buttonActive.value === "button" && queueOptions.length <= 4) {
      return botButton();
    }

    if (buttonActive.value === "text") {
      return botText();
    }

    if (buttonActive.value === "button" && queueOptions.length > 4) {
      return botText();
    }
  } else if (!isNil(queue) && !isNil(ticket.queueOptionId)) {
    const currentOption = await QueueOption.findByPk(ticket.queueOptionId);
    const queueOptions = await QueueOption.findAll({
      where: { parentId: ticket.queueOptionId },
      order: [
        ["option", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

      const companyId = ticket.companyId;
      const buttonActive = await Setting.findOne({
        where: {
          key: "chatBotType",
          companyId
        }
      });

      const botList = async () => {
        const sectionsRows = [];

        queueOptions.forEach((option, i) => {
          sectionsRows.push({
            title: option.title,
            rowId: `${option.option}`
          });
        });
        sectionsRows.push({
          title: "Menu inicial *[ 0 ]* Menu anterior",
          rowId: `#`
        });
        const sections = [
          {
            rows: sectionsRows
          }
        ];

        const listMessage = {
          text: formatBody(`\u200e${currentOption.message}`, ticket.contact),
          buttonText: "Escolha uma opção",
          sections
        };

        const sendMsg = await wbot.sendMessage(getContactJid(ticket.contact),
          listMessage
        );

        await verifyMessage(sendMsg, ticket, ticket.contact);
      }

      const botButton = async () => {
        const buttons = [];
        queueOptions.forEach((option, i) => {
          buttons.push({
            buttonId: `${option.option}`,
            buttonText: { displayText: option.title },
            type: 4
          });
        });
        buttons.push({
          buttonId: `#`,
          buttonText: { displayText: "Menu inicial *[ 0 ]* Menu anterior" },
          type: 4
        });

        const buttonMessage = {
          text: formatBody(`\u200e${currentOption.message}`, ticket.contact),
          buttons,
          headerType: 4
        };

        const sendMsg = await wbot.sendMessage(getContactJid(ticket.contact),
          buttonMessage
        );

        await verifyMessage(sendMsg, ticket, ticket.contact);
      }

      const botText = async () => {

        let options = "";

        queueOptions.forEach((option, i) => {
          options += `*[ ${option.option} ]* - ${option.title}\n`;
        });
        options += `\n*[ 0 ]* - Menu anterior`;
        options += `\n*[ # ]* - Menu inicial`;
        const textMessage = {
          text: formatBody(`\u200e${currentOption.message}\n\n${options}`, ticket.contact),
        };

        const sendMsg = await wbot.sendMessage(getContactJid(ticket.contact), textMessage);

        await verifyMessage(sendMsg, ticket, ticket.contact);
        if (currentOption.mediaPath !== null && currentOption.mediaPath !== "")  {

          const filePath = path.resolve("public", currentOption.mediaPath);


          const optionsMsg = await getMessageOptions(currentOption.mediaName, filePath);

          let sentMessage = await wbot.sendMessage(getContactJid(ticket.contact), { ...optionsMsg });

          await verifyMediaMessage(sentMessage, ticket, ticket.contact);
        }
      };

      if (buttonActive.value === "list") {
        return botList();
      }

      if (buttonActive.value === "button" && queueOptions.length <= 4) {
        return botButton();
      }

      if (buttonActive.value === "text") {
        return botText();
      }

      if (buttonActive.value === "button" && queueOptions.length > 4) {
        return botText();
      }
  }
}
