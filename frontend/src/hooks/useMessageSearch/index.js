import { useCallback, useEffect, useRef, useState } from "react";

import api from "../../services/api";
import toastError from "../../errors/toastError";

// Chamado #95: busca de mensagens por palavra-chave (GET /messages/search).
// O backend ignora termos com menos de 3 caracteres, então nem chamamos a API.
export const MIN_MESSAGE_SEARCH_LENGTH = 3;

const useMessageSearch = ({ searchParam, ticketId, enabled = true }) => {
  const term = (searchParam || "").trim();
  const active = enabled && term.length >= MIN_MESSAGE_SEARCH_LENGTH;

  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // termo cujos resultados estão em `messages` (vazio = nada carregado ainda)
  const [loadedTerm, setLoadedTerm] = useState("");

  const requestIdRef = useRef(0);
  const pageRef = useRef(1);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(
    async (pageNumber) => {
      // cada requisição ganha um id; resposta de requisição antiga (termo
      // anterior, conversa anterior) é descartada
      const requestId = ++requestIdRef.current;
      loadingRef.current = true;
      setLoading(true);
      try {
        const { data } = await api.get("/messages/search", {
          params: { searchParam: term, ticketId, pageNumber },
        });
        if (requestId !== requestIdRef.current) return;

        const page = data?.messages || [];
        setMessages((prev) => {
          if (pageNumber === 1) return page;
          const known = new Set(prev.map((m) => m.id));
          return [...prev, ...page.filter((m) => !known.has(m.id))];
        });
        setHasMore(!!data?.hasMore && page.length > 0);
        setError(false);
        setLoadedTerm(term);
        pageRef.current = pageNumber;
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setHasMore(false);
        if (pageNumber === 1) {
          setError(true);
          setLoadedTerm(term);
        }
        toastError(err);
      }
      loadingRef.current = false;
      setLoading(false);
    },
    [term, ticketId]
  );

  useEffect(() => {
    requestIdRef.current++;
    loadingRef.current = false;
    pageRef.current = 1;
    setMessages([]);
    setHasMore(false);
    setError(false);
    setLoadedTerm("");
    setLoading(false);

    if (active) {
      fetchPage(1);
    }
  }, [active, fetchPage]);

  const loadMore = useCallback(() => {
    if (!active || !hasMore || loadingRef.current) return;
    fetchPage(pageRef.current + 1);
  }, [active, hasMore, fetchPage]);

  return {
    term,
    messages,
    hasMore,
    loading,
    error,
    loadMore,
    // a lista corresponde ao termo atual (evita mostrar "sem resultados" ou o
    // contador de um termo anterior enquanto o novo carrega)
    loaded: active && loadedTerm === term,
    tooShort: term.length > 0 && term.length < MIN_MESSAGE_SEARCH_LENGTH,
  };
};

export default useMessageSearch;
