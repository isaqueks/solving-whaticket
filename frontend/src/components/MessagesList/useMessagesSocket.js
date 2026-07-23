import { useContext, useEffect } from "react";

import { SocketContext } from "../../context/Socket/SocketContext";
import { ClientSocketEvents, SocketEvents } from "../../services/socketEvents";
import useSocketEvent from "../../hooks/useSocketEvent";

/**
 * Assinaturas de socket do MessagesList (nomes de evento inalterados, via
 * contrato src/services/socketEvents.js):
 *
 * - `ready` → entra na sala do ticket (joinChatBox). Fica num effect próprio
 *   (não no useSocketEvent) porque o handler precisa do MESMO socket para
 *   emitir o join — e o ManagedSocket registra o join para re-join no
 *   reconnect e leave no cleanup.
 * - `company-{companyId}-appMessage` → create/update de mensagem do ticket
 *   aberto (guarda por currentTicketId, como no original).
 */
export const useMessagesSocket = ({
  ticket,
  ticketId,
  currentTicketId,
  dispatch,
  scrollToBottom,
}) => {
  const socketManager = useContext(SocketContext);
  const companyId = localStorage.getItem("companyId");

  useEffect(() => {
    const socket = socketManager.getSocket(companyId);

    socket.on(SocketEvents.ready, () =>
      socket.emit(ClientSocketEvents.joinChatBox, `${ticket.id}`)
    );

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, ticket, socketManager]);

  useSocketEvent(SocketEvents.companyAppMessage(companyId), (data) => {
    if (data.action === "create" && data.message.ticketId === currentTicketId.current) {
      dispatch({ type: "ADD_MESSAGE", payload: data.message });
      scrollToBottom();
    }

    if (data.action === "update" && data.message.ticketId === currentTicketId.current) {
      dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
    }
  });
};
