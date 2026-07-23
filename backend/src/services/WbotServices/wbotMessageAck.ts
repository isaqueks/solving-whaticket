import { WAMessage } from "baileys";

import { getIO } from "../../libs/socket";
import Message from "../../models/Message";
import { logger } from "../../utils/logger";

const ackMap = new Map<string, number>();

export const handleMsgAck = async (
  msg: WAMessage,
  chat: number
) => {
  if (!chat || ackMap.get(msg.key.id) >= chat) {
    return;
  }
  ackMap.set(msg.key.id, chat);
  await new Promise((r) => setTimeout(r, 2000));
  const io = getIO();

  try {
    chat = ackMap.get(msg.key.id)!;
    const messageToUpdate = await Message.findByPk(msg.key.id);

    if (!messageToUpdate) return;
    await messageToUpdate.update({ ack: chat });
    io.to(messageToUpdate.ticketId.toString()).emit(
      `company-${messageToUpdate.companyId}-appMessage`,
      {
        action: "update",
        message: messageToUpdate,
      }
    );
  } catch (err) {
    logger.error(`Error handling message ack. Err: ${err}`);
  } finally {
    ackMap.delete(msg.key.id);
  }
};
