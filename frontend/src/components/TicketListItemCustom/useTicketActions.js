import { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";

import { ticketsApi } from "../../api/TicketsApi";
import { settingsApi } from "../../api/SettingsApi";
import { messagesApi } from "../../api/MessagesApi";
import toastError from "../../errors/toastError";

/**
 * Ações do card de ticket: aceitar, finalizar e reabrir atendimento (+ a
 * saudação automática opcional no accept). Toda I/O passa pelas classes de API;
 * a lógica veio tal-qual do index.js. `isMounted` fica aqui — é a guarda dos
 * setLoading pós-await, como no componente original.
 */
export const useTicketActions = ({ ticket, user, setTag }) => {
  const history = useHistory();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleCloseTicket = async (id) => {
    setTag(ticket?.tags);
    setLoading(true);
    try {
      await ticketsApi.update(id, {
        status: "closed",
        userId: user?.id,
        queueId: ticket?.queue?.id,
        useIntegration: false,
        promptId: null,
        integrationId: null,
      });
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
    if (isMounted.current) {
      setLoading(false);
    }
    history.push(`/tickets/`);
  };

  const handleReopenTicket = async (id) => {
    setLoading(true);
    try {
      await ticketsApi.update(id, {
        status: "open",
        userId: user?.id,
        queueId: ticket?.queue?.id,
      });
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
    if (isMounted.current) {
      setLoading(false);
    }
    history.push(`/tickets/${ticket.uuid}`);
  };

  // Mensagem de saudação automática
  const handleSendMessage = async (id) => {
    const msg = `{{ms}} *{{name}}*, meu nome é *${user?.name}* e agora vou prosseguir com seu atendimento!`;
    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: `*Mensagem Automática:*\n${msg.trim()}`,
    };
    try {
      await messagesApi.send(id, message);
    } catch (err) {
      toastError(err);
    }
  };

  const handleAcepptTicket = async (id) => {
    setLoading(true);
    try {
      await ticketsApi.update(id, {
        status: "open",
        userId: user?.id,
      });

      // Verifica setting para envio de saudação (opcional)
      let settingIndex;
      try {
        const { data } = await settingsApi.getAll();
        settingIndex = data.filter((s) => s.key === "sendGreetingAccepted");
      } catch (err) {
        toastError(err);
      }

      if (settingIndex?.[0]?.value === "enabled" && !ticket.isGroup) {
        handleSendMessage(ticket.id);
      }
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
    if (isMounted.current) {
      setLoading(false);
    }
    history.push(`/tickets/${ticket.uuid}`);
  };

  return {
    loading,
    handleCloseTicket,
    handleReopenTicket,
    handleAcepptTicket,
  };
};
