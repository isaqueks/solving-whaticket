import Ticket from "../../tickets/models/Ticket";
import Message from "../models/Message";

/**
 * Id serializado de mensagem no formato do WhatsApp (utilitário puro, movido
 * do antigo `helpers/SerializeWbotMsgId.ts`). Sem chamadores hoje — mantido
 * pelo plano B4 como parte do contrato do domínio.
 */
export const SerializeWbotMsgId = (ticket: Ticket, message: Message): string => {
  const serializedMsgId = `${message.fromMe}_${ticket.contact.number}@${
    ticket.isGroup ? "g" : "c"
  }.us_${message.id}`;

  return serializedMsgId;
};

export default SerializeWbotMsgId;
