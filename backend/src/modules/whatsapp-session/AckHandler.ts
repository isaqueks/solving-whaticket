import { WAMessage } from "baileys";

import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { logger } from "../../utils/logger";

import { MessagesRepository } from "../messages/MessagesRepository";

/**
 * Atualização de ACK das mensagens enviadas (antigo `wbotMessageAck`): o mapa
 * de coalescência por id virou estado da instância do singleton — vida de
 * processo idêntica ao antigo estado de módulo (a janela de 2s continua
 * agrupando os acks intermediários de um mesmo id).
 */
export class AckHandler {
  private readonly ackMap = new Map<string, number>();

  constructor(
    private readonly messagesRepository = new MessagesRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async handleMsgAck(msg: WAMessage, chat: number): Promise<void> {
    if (!chat || this.ackMap.get(msg.key.id) >= chat) {
      return;
    }
    this.ackMap.set(msg.key.id, chat);
    await new Promise((r) => setTimeout(r, 2000));

    try {
      chat = this.ackMap.get(msg.key.id)!;
      const messageToUpdate = await this.messagesRepository.findByPrimaryKey(
        msg.key.id
      );

      if (!messageToUpdate) return;
      await this.messagesRepository.updateInstance(messageToUpdate, {
        ack: chat
      });
      this.realtime.emitAppMessageToTicketRoom(
        messageToUpdate.companyId,
        messageToUpdate.ticketId,
        {
          action: "update",
          message: messageToUpdate,
        }
      );
    } catch (err) {
      logger.error(`Error handling message ack. Err: ${err}`);
    } finally {
      this.ackMap.delete(msg.key.id);
    }
  }
}

/** Singleton — o ackMap de coalescência precisa ser único no processo. */
export const ackHandler = new AckHandler();
