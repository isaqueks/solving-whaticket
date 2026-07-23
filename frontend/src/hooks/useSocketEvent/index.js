import { useContext, useEffect, useRef } from "react";

import { SocketContext } from "../../context/Socket/SocketContext";

/**
 * Assina um evento de socket com cleanup automático.
 *
 * Obtém o socket pelo SocketContext (SocketManager.getSocket(companyId), mesmo
 * padrão de pages/Files e useWhatsApps) e sempre remove a assinatura no
 * unmount / troca de deps via `socket.disconnect()` — o mesmo cleanup dos
 * componentes bem-comportados do projeto.
 *
 * O handler é guardado em ref: mudar a identidade do handler entre renders NÃO
 * re-assina o socket (evita churn). Passe `deps` só quando o alvo da assinatura
 * muda (ex.: um `eventName` templated com id que varia).
 *
 * @param {string} eventName Nome do evento (use src/services/socketEvents.js).
 * @param {(...args:any[]) => void} handler Callback do evento.
 * @param {any[]} [deps] Dependências extras que forçam re-assinatura.
 */
const useSocketEvent = (eventName, handler, deps = []) => {
  const socketManager = useContext(SocketContext);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!eventName) {
      return undefined;
    }

    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const listener = (...args) => handlerRef.current?.(...args);
    socket.on(eventName, listener);

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketManager, eventName, ...deps]);
};

export default useSocketEvent;
