import {
  BinaryNode,
  Contact as BContact,
} from "baileys";
import * as Sentry from "@sentry/node";

import { logger } from "../../utils/logger";

import { ContactsRepository } from "../contacts/ContactsRepository";
import { CreateMessageData } from "../messages/dtos/CreateMessageDto";
// Ciclo MessagesService ⇄ módulo da sessão: usar o singleton SEMPRE dentro do
// corpo dos métodos (binding CommonJS resolve lazy na chamada).
import { messagesService } from "../messages/MessagesService";
// Singleton do domínio settings (leaf) — uso em tempo de chamada.
import { settingsService } from "../settings/SettingsService";
import { TicketsRepository } from "../tickets/TicketsRepository";
import Whatsapp from "../whatsapp/models/Whatsapp";

import { BaileysStore } from "./BaileysStore";
import { Session } from "./types";

/**
 * Monitor de eventos auxiliares da sessão (antigo `wbotMonitor`): resposta
 * automática a chamadas de voz/vídeo (CB:call) e sincronização de contatos do
 * aparelho (contacts.upsert). Lógica preservada linha a linha.
 */
export class SessionMonitor {
  constructor(
    private readonly contactsRepository = new ContactsRepository(),
    private readonly ticketsRepository = new TicketsRepository(),
    private readonly baileysStore = new BaileysStore()
  ) {}

  public async attach(
    wbot: Session,
    whatsapp: Whatsapp,
    companyId: number
  ): Promise<void> {
    try {
      wbot.ws.on("CB:call", async (node: BinaryNode) => {
        const content = node.content[0] as any;

        if (content.tag === "terminate") {
          const sendMsgCall = await settingsService.getByKey({
            key: "call",
            companyId
          });

          if (sendMsgCall?.value === "disabled") {
            await wbot.sendMessage(node.attrs.from, {
              text:
                "*Mensagem Automática:*\n\nAs chamadas de voz e vídeo estão desabilitas para esse WhatsApp, favor enviar uma mensagem de texto. Obrigado",
            });

            const number = node.attrs.from.replace(/[^0-9|-]/g, "");

            const contact = await this.contactsRepository.findByNumberAndCompany(
              number,
              companyId
            );
            // se não existir o contato não faz nada.
            if (!contact) return undefined;

            const ticket = await this.ticketsRepository.findOneByContactAndWhatsapp(
              contact.id,
              wbot.id,
              companyId
            );
            // se não existir o ticket não faz nada.
            if (!ticket) return undefined;

            const date = new Date();
            const hours = date.getHours();
            const minutes = date.getMinutes();

            const body = `Chamada de voz/vídeo perdida às ${hours}:${minutes}`;
            const messageData: CreateMessageData = {
              id: content.attrs["call-id"],
              ticketId: ticket.id,
              contactId: contact.id,
              body,
              fromMe: false,
              mediaType: "call_log",
              read: true,
              quotedMsgId: null,
              ack: 1,
            };

            await this.ticketsRepository.updateInstance(ticket, {
              lastMessage: body,
              updatedAt: new Date(),
            });

            if (ticket.status === "closed") {
              await this.ticketsRepository.updateInstance(ticket, {
                status: "pending",
              });
            }

            return messagesService.create({ messageData, companyId: companyId });
          }
        }

        return undefined;
      });

      wbot.ev.on("contacts.upsert", async (contacts: BContact[]) => {
        await this.baileysStore.createOrUpdate({
          whatsappId: whatsapp.id,
          contacts,
        });
      });

    } catch (err) {
      Sentry.captureException(err);
      logger.error(err);
    }
  }
}

export const sessionMonitor = new SessionMonitor();
