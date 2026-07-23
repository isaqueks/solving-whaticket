import axios from "axios";
import { delay, proto } from "baileys";
import { isNil } from "lodash";

import QueueIntegrations from "../queue-integrations/models/QueueIntegrations";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { logger } from "../../utils/logger";

import Ticket from "../tickets/models/Ticket";
import { TicketsRepository } from "../tickets/TicketsRepository";
// Ciclo TicketsService ⇄ módulo da sessão: usar o singleton SEMPRE dentro do
// corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { ticketsService } from "../tickets/TicketsService";
import { QueuesService } from "../queues/QueuesService";

import { MessageParser } from "./MessageParser";
import { Session } from "./types";

/** Entrada do fluxo (forma do antigo typebotListener). */
export interface TypebotListenRequest {
  wbot: Session;
  msg: proto.IWebMessageInfo;
  ticket: Ticket;
  typebot: QueueIntegrations;
}

/**
 * Conversa de um ticket com um bot Typebot (antigo
 * `TypebotServices/typebotListener.ts`) — cria/continua a sessão remota,
 * renderiza o richText das respostas e trata os gatilhos (#json, \FINISH,
 * \TRANSFER). Lógica VERBATIM do original; a função local `transferQueue`
 * do arquivo antigo era código morto (nunca chamada — verificado por grep)
 * e foi removida.
 */
export class TypebotSession {
  constructor(
    private readonly ticketsRepository = new TicketsRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async listen({
    wbot,
    msg,
    ticket,
    typebot
  }: TypebotListenRequest): Promise<void> {
    if (msg.key.remoteJid === 'status@broadcast') return;

    const { urlN8N: url,
        typebotExpires,
        typebotKeywordFinish,
        typebotKeywordRestart,
        typebotUnknownMessage,
        typebotSlug,
        typebotDelayMessage,
        typebotRestartMessage
    } = typebot;

    const number = msg.key.remoteJid.replace(/[^0-9|-]/g, '');
    const jid = msg.key.remoteJid;

    let body = MessageParser.getBodyMessage(msg);

    async function createSession(
        msg: proto.IWebMessageInfo,
        typebot: QueueIntegrations,
        number: string
    ) {
        try {
            const id = Math.floor(Math.random() * 10000000000).toString();

            const reqData = JSON.stringify({
                "isStreamEnabled": true,
                "message": "string",
                "resultId": "string",
                "isOnlyRegistering": false,
                "prefilledVariables": {
                    "number": number,
                    "pushName": msg.pushName || ""
                },
            });

            const config = {
                method: 'post',
                maxBodyLength: Infinity,
                timeout: 60000,
                url: `${url}/api/v1/typebots/${typebotSlug}/startChat`,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                data: reqData
            };

            const request = await axios.request(config);

            return request.data;

        } catch (err) {
            logger.info("Erro ao criar sessão do typebot: ", err)
            throw err;
        }
    }

    let sessionId
    let dataStart
    let status = false;
    try {
        const dataLimite = new Date()
        dataLimite.setMinutes(dataLimite.getMinutes() - Number(typebotExpires));

        if (typebotExpires > 0 && ticket.updatedAt < dataLimite) {
            await this.ticketsRepository.updateInstance(ticket, {
                typebotSessionId: null,
                isBot: true
            });

            await this.ticketsRepository.reload(ticket);
        }

        if (isNil(ticket.typebotSessionId)) {
            dataStart = await createSession(msg, typebot, number);
            sessionId = dataStart.sessionId
            status = true;
            await this.ticketsRepository.updateInstance(ticket, {
                typebotSessionId: sessionId,
                typebotStatus: true,
                useIntegration: true,
                integrationId: typebot.id
            })
        } else {
            sessionId = ticket.typebotSessionId;
            status = ticket.typebotStatus;
        }

        if (!status) return;

        //let body = getConversationMessage(msg);

        let finish = false;
        let transfer = false;

        if (body !== typebotKeywordFinish && body !== typebotKeywordRestart) {
            let requestContinue
            let messages
            let input
            if (dataStart?.messages.length === 0 || dataStart === undefined) {
                const reqData = JSON.stringify({
                    "message": body
                });

                let config = {
                    method: 'post',
                    maxBodyLength: Infinity,
                    timeout: 60000,
                    url: `${url}/api/v1/sessions/${sessionId}/continueChat`,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    data: reqData
                };
                try {
                    requestContinue = await axios.request(config);
                }
                catch (err) {
                    if (err?.status === 404) {
                        console.error(`[${jid}] Session ${sessionId} not found, creating a new one.`);
                        dataStart = await createSession(msg, typebot, number);
                        sessionId = dataStart.sessionId
                        status = true;
                        await this.ticketsRepository.updateInstance(ticket, {
                            typebotSessionId: sessionId,
                            typebotStatus: true,
                            useIntegration: true,
                            integrationId: typebot.id
                        });

                        console.log(`[${jid}] New session created: `, sessionId);

                        config = {
                            method: 'post',
                            maxBodyLength: Infinity,
                            timeout: 60000,
                            url: `${url}/api/v1/sessions/${sessionId}/continueChat`,
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            data: reqData
                        };

                        requestContinue = await axios.request(config);
                    } else {
                        throw err;
                    }
                }
                messages = requestContinue.data?.messages;
                input = requestContinue.data?.input;
            } else {
                messages = dataStart?.messages;
                input = dataStart?.input;
            }

            if (messages?.length === 0) {
                await wbot.sendMessage(jid, { text: typebotUnknownMessage });
            } else {
                for (const message of messages) {
                    console.log(JSON.stringify(message, null, 2))
                    if (message.type === 'text') {
                        let formattedText = '';
                        let linkPreview = false;
                        for (const richText of message.content.richText) {
                            for (const element of richText.children) {
                                let text = '';

                                if (element.text) {
                                    text = element.text;
                                }
                                if (richText.type === 'variable') {
                                    text += '\n';
                                }
                                if (richText.type === 'blockquote') {
                                    text = `> ${text}`;
                                }
                                if (element.type && element.children) {
                                    for (const subelement of element.children) {
                                        let text = '';

                                        if (subelement.text) {
                                            text = subelement.text;
                                        }
                                        if (element.type === 'variable') {
                                            text += '\n';
                                        }
                                        if (element.type === 'blockquote') {
                                            text = `> ${text}`;
                                        }

                                        if (subelement.type && subelement.children) {
                                            for (const subelement2 of subelement.children) {
                                                let text = '';

                                                if (subelement2.text) {
                                                    text = subelement2.text;
                                                }
                                                if (subelement.type === 'variable') {
                                                    text += '\n';
                                                }
                                                if (subelement.type === 'blockquote') {
                                                    text = `> ${text}`;
                                                }

                                                if (subelement2.bold) {
                                                    text = `*${text}*`;
                                                }
                                                if (subelement2.italic) {
                                                    text = `_${text}_`;
                                                }
                                                if (subelement2.underline) {
                                                    text = `~${text}~`;
                                                }
                                                if (subelement2.url) {
                                                    const linkText = subelement2.children[0].text;
                                                    text = `[${linkText}](${subelement2.url})`;
                                                    linkPreview = true;
                                                }
                                                formattedText += text;
                                            }
                                        }
                                        if (subelement.bold) {
                                            text = `*${text}*`;
                                        }
                                        if (subelement.italic) {
                                            text = `_${text}_`;
                                        }
                                        if (subelement.underline) {
                                            text = `~${text}~`;
                                        }
                                        if (subelement.url) {
                                            const linkText = subelement.children[0].text;
                                            text = `[${linkText}](${subelement.url})`;
                                            linkPreview = true;
                                        }
                                        formattedText += text;
                                    }
                                }

                                if (element.bold) {
                                    text = `*${text}*`
                                }
                                if (element.italic) {
                                    text = `_${text}_`;
                                }
                                if (element.underline) {
                                    text = `~${text}~`;
                                }

                                if (element.url) {
                                    const linkText = element.children[0].text;
                                    text = `[${linkText}](${element.url})`;
                                    linkPreview = true;
                                }

                                formattedText += text;
                            }
                            formattedText += '\n';
                        }
                        formattedText = formattedText.replace('**', '').replace(/\n$/, '');

                        if (formattedText === "Invalid message. Please, try again.") {
                            formattedText = typebotUnknownMessage;
                        }

                        if (formattedText.startsWith("#")) {
                            let gatilho = formattedText.replace("#", "");

                            try {
                                let jsonGatilho = JSON.parse(gatilho);

                                if (jsonGatilho.stopBot && isNil(jsonGatilho.userId) && isNil(jsonGatilho.queueId)) {
                                    await this.ticketsRepository.updateInstance(ticket, {
                                        useIntegration: false,
                                        isBot: false
                                    })

                                    return;
                                }
                                if (!isNil(jsonGatilho.queueId) && jsonGatilho.queueId > 0 && isNil(jsonGatilho.userId)) {
                                    await ticketsService.update({
                                        ticketData: {
                                            queueId: jsonGatilho.queueId,
                                            chatbot: false,
                                            useIntegration: false,
                                            integrationId: null
                                        },
                                        ticketId: ticket.id,
                                        companyId: ticket.companyId
                                    })

                                    return;
                                }

                                if (!isNil(jsonGatilho.queueId) && jsonGatilho.queueId > 0 && !isNil(jsonGatilho.userId) && jsonGatilho.userId > 0) {
                                    await ticketsService.update({
                                        ticketData: {
                                            queueId: jsonGatilho.queueId,
                                            userId: jsonGatilho.userId,
                                            chatbot: false,
                                            useIntegration: false,
                                            integrationId: null
                                        },
                                        ticketId: ticket.id,
                                        companyId: ticket.companyId
                                    })

                                    return;
                                }
                            } catch (err) {
                                throw err
                            }
                        }

                        await wbot.presenceSubscribe(msg.key.remoteJid)
                        //await delay(2000)
                        await wbot.sendPresenceUpdate('composing', msg.key.remoteJid)
                        await delay(typebotDelayMessage)
                        await wbot.sendPresenceUpdate('paused', msg.key.remoteJid)

                        console.log(formattedText)
                        if (formattedText.trim().includes('\\FINISH')) {
                            finish = true;
                            formattedText = formattedText.replace('\\FINISH', '').trim();
                        }
                        else if (formattedText.trim().includes('\\TRANSFER')) {
                            transfer = true;
                            formattedText = formattedText.replace('\\TRANSFER', '').trim();
                        }
                        await wbot.sendMessage(msg.key.remoteJid, { text: formattedText });
                    }

                    if (message.type === 'audio') {
                        await wbot.presenceSubscribe(msg.key.remoteJid)
                        //await delay(2000)
                        await wbot.sendPresenceUpdate('composing', msg.key.remoteJid)
                        await delay(typebotDelayMessage)
                        await wbot.sendPresenceUpdate('paused', msg.key.remoteJid)
                        const media = {
                            audio: {
                                url: message.content.url,
                                mimetype: 'audio/mp4',
                                ptt: true
                            },
                        }
                        await wbot.sendMessage(msg.key.remoteJid, media);

                    }

                    // if (message.type === 'embed') {
                    //     await wbot.presenceSubscribe(msg.key.remoteJid)
                    //     //await delay(2000)
                    //     await wbot.sendPresenceUpdate('composing', msg.key.remoteJid)
                    //     await delay(typebotDelayMessage)
                    //     await wbot.sendPresenceUpdate('paused', msg.key.remoteJid)
                    //     const media = {

                    //         document: { url: message.content.url },
                    //         mimetype: 'application/pdf',
                    //         caption: ""

                    //     }
                    //     await wbot.sendMessage(msg.key.remoteJid, media);
                    // }

                    if (message.type === 'image') {
                        await wbot.presenceSubscribe(msg.key.remoteJid)
                        //await delay(2000)
                        await wbot.sendPresenceUpdate('composing', msg.key.remoteJid)
                        await delay(typebotDelayMessage)
                        await wbot.sendPresenceUpdate('paused', msg.key.remoteJid)
                        const media = {
                            image: {
                                url: message.content.url,
                            },

                        }
                        await wbot.sendMessage(msg.key.remoteJid, media);
                    }

                    // if (message.type === 'video' ) {
                    //     await wbot.presenceSubscribe(msg.key.remoteJid)
                    //     //await delay(2000)
                    //     await wbot.sendPresenceUpdate('composing', msg.key.remoteJid)
                    //     await delay(typebotDelayMessage)
                    //     await wbot.sendPresenceUpdate('paused', msg.key.remoteJid)
                    //     const media = {
                    //         video: {
                    //             url: message.content.url,
                    //         },

                    //     }
                    //     await wbot.sendMessage(msg.key.remoteJid, media);
                    // }
                }
                if (input) {
                    if (input.type === 'choice input') {
                        let formattedText = '';
                        const items = input.items;
                        for (const item of items) {
                            formattedText += `▶️ ${item.content}\n`;
                        }
                        formattedText = formattedText.replace(/\n$/, '');
                        await wbot.presenceSubscribe(msg.key.remoteJid)
                        //await delay(2000)
                        await wbot.sendPresenceUpdate('composing', msg.key.remoteJid)
                        await delay(typebotDelayMessage)
                        await wbot.sendPresenceUpdate('paused', msg.key.remoteJid)
                        await wbot.sendMessage(msg.key.remoteJid, { text: formattedText });

                    }
                }
            }
        }
        if (body === typebotKeywordRestart) {
            await this.ticketsRepository.updateInstance(ticket, {
                isBot: true,
                typebotSessionId: null
            })

            await this.ticketsRepository.reload(ticket);

            await wbot.sendMessage(jid, { text: typebotRestartMessage })

        }
        if (body === typebotKeywordFinish) {
            await ticketsService.update({
                ticketData: {
                    status: "closed",
                    useIntegration: false,
                    integrationId: null
                },
                ticketId: ticket.id,
                companyId: ticket.companyId
            })

            return;
        }

        if (finish) {
            await ticketsService.update({
                ticketData: {
                    status: "closed",
                    useIntegration: false,
                    integrationId: null
                },
                ticketId: ticket.id,
                companyId: ticket.companyId
            })
        }
        if (transfer) {
            const queues = await new QueuesService().list({ companyId: typebot.companyId });
            const q = queues.find(q => q.name.toLowerCase() == 'atendente') || queues.find(q => !q.integrationId);
            const oldStatus = ticket.status;
            if (!q) {
                await ticketsService.update({
                    ticketData: {
                        status: "closed",
                        useIntegration: false,
                        integrationId: null,
                    },
                    ticketId: ticket.id,
                    companyId: ticket.companyId
                })
            }
            else {
                await ticketsService.update({
                    ticketData: {
                        status: "pending",
                        useIntegration: false,
                        integrationId: null,
                        queueId: q.id
                    },
                    ticketId: ticket.id,
                    companyId: ticket.companyId
                })
            }

            await this.ticketsRepository.reload(ticket);

            this.realtime.emitTicketToStatusRooms(
                {
                    companyId: ticket.companyId,
                    status: oldStatus,
                    queueId: ticket.queueId,
                    ticketId: ticket.id.toString()
                },
                {
                    action: "update",
                    ticket,
                    ticketId: ticket.id,
                }
            );
        }
    } catch (error) {
        logger.info("Error on typebotListener: ", error);
        await this.ticketsRepository.updateInstance(ticket, {
            typebotSessionId: null
        })
        throw error;
    }
  }
}

export const typebotSession = new TypebotSession();
