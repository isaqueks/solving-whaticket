import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { messagesApi } from "../../api/MessagesApi";
import toastError from "../../errors/toastError";

/**
 * Reducer local do MessagesList — deliberadamente NÃO migrado para
 * createEntityReducer (decisão da F1): o LOAD_MESSAGES faz *prepend*
 * (paginação para trás), ADD_MESSAGE faz upsert com append e REMOVE_MESSAGE
 * recebe uma FUNÇÃO de filtro como payload. Semântica movida tal-qual do
 * index.js original.
 */
const reducer = (state, action) => {
  if (action.type === "LOAD_MESSAGES") {
    const messages = action.payload;
    const newMessages = [];

    messages.forEach((message) => {
      const messageIndex = state.findIndex((m) => m.id === message.id);
      if (messageIndex !== -1) {
        state[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });

    return [...newMessages, ...state];
  }

  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    const messageIndex = state.findIndex((m) => m.id === newMessage.id);

    if (messageIndex !== -1) {
      state[messageIndex] = newMessage;
    } else {
      state.push(newMessage);
    }

    return [...state];
  }

  if (action.type === "UPDATE_MESSAGE") {
    const messageToUpdate = action.payload;
    const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);

    if (messageIndex !== -1) {
      state[messageIndex] = messageToUpdate;
    }

    return [...state];
  }

  if (action.type === 'REMOVE_MESSAGE') {
    const filterFn = action.payload;
    return state.filter(filterFn);
  }

  if (action.type === "RESET") {
    return [];
  }
};

/**
 * Estado da lista de mensagens do ticket: reducer + fetch paginado (com
 * debounce) + scroll infinito para trás + reconciliação das mensagens
 * otimistas (pendingMessages) + mapa de mensagens sobrescritas por edição.
 * Toda a lógica veio tal-qual do index.js; o componente fica só com UI.
 */
export const useMessagesList = (ticketId, { pendingMessages, setPendingMessages }) => {
  const [messagesList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentTicketId = useRef(ticketId);
  const loadingRef = useRef(false);
  const lastMessageRef = useRef();

  const scrollToBottom = () => {
    if (lastMessageRef.current) {
      const lastMessageElement = lastMessageRef.current;
      // 1. Tenta scrollar de forma segura, sem mexer no host
      lastMessageElement.parentElement.scrollTop = Number.MAX_SAFE_INTEGER;
    }
  };

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);

    currentTicketId.current = ticketId;
  }, [ticketId]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchMessages = async () => {
        if (ticketId === undefined) return;
        try {
          const { data } = await messagesApi.list(ticketId, { pageNumber });

          if (currentTicketId.current === ticketId) {
            dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
            setHasMore(data.hasMore);
            setLoading(false);
            loadingRef.current = false;
          }

          if (pageNumber === 1 && data.messages.length > 1) {
            scrollToBottom();
          }
        } catch (err) {
          setLoading(false);
          loadingRef.current = false;
          toastError(err);
        }
      };
      fetchMessages();
    }, 20);
    return () => {
      clearTimeout(delayDebounceFn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, ticketId]);

  useEffect(() => {
    if (pendingMessages?.length > 0) {
      scrollToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessages]);

  useEffect(() => {
    const toRemove = [];

    for (const pending of pendingMessages) {
      const correspondingMessage = messagesList.find(
        m =>
          m.body === pending.body &&
          m.fromMe === pending.fromMe &&
          m.mediaType === pending.mediaType &&
          +new Date(m.createdAt) >= (+new Date(pending.createdAt) - 5 * 60 * 1000)
      );

      if (correspondingMessage) {
        toRemove.push(pending);
      }
    }

    if (toRemove.length > 0) {
      setPendingMessages((prevPendingMessages) =>
        prevPendingMessages.filter((msg) => !toRemove.includes(msg))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesList, pendingMessages]);

  // Maps a message id to the most recent edited message that overwrites it.
  // Computed once per messagesList change (O(edited)) instead of parsing every
  // edited message's dataJson for every rendered message on every render.
  const overwrittenMessages = useMemo(() => {
    const map = new Map();
    for (const msg of messagesList) {
      if (!msg.isEdited) continue;
      try {
        const raw = JSON.parse(msg.dataJson);
        const targetId = (
          raw?.message?.editedMessage?.message?.protocolMessage?.key?.id ||
          raw?.message?.protocolMessage?.key?.id
        );
        if (!targetId) continue;
        const existing = map.get(targetId);
        if (!existing || new Date(msg.createdAt) > new Date(existing.createdAt)) {
          map.set(targetId, msg);
        }
      } catch {
        // ignore malformed dataJson
      }
    }
    return map;
  }, [messagesList]);

  const loadMore = () => {
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore) return;
    const { scrollTop } = e.currentTarget;

    if (scrollTop === 0) {
      document.getElementById("messagesList").scrollTop = 1;
    }

    if (loading || loadingRef.current) {
      return;
    }

    if (scrollTop < 50) {
      loadingRef.current = true;
      loadMore();
    }
  };

  return {
    messagesList,
    dispatch,
    loading,
    handleScroll,
    lastMessageRef,
    scrollToBottom,
    currentTicketId,
    overwrittenMessages,
  };
};
