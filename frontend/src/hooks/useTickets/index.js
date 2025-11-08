import { useEffect, useState } from "react";
import toastError from "../../errors/toastError";

import api from "../../services/api";
import { TicketCache } from "../../services/ticket-cache";

const useTickets = ({
  searchParam,
  tags,
  users,
  pageNumber,
  status,
  date,
  updatedAt,
  showAll,
  queueIds,
  withUnreadMessages,
  unread
}) => {
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTickets = async () => {
        try {
          // const { data } = await api.get("/tickets", {
          //   params: {
          //     searchParam,
          //     pageNumber,
          //     tags,
          //     users,
          //     status,
          //     date,
          //     updatedAt,
          //     showAll,
          //     queueIds,
          //     withUnreadMessages,
          //     unread
          //   },
          // });
          const params = {
            searchParam,
            pageNumber,
            tags,
            users,
            status,
            date,
            updatedAt,
            showAll,
            queueIds,
            withUnreadMessages,
            unread
          };
          const data = await TicketCache.getTickets(params);
          setTickets(data.tickets);
          setHasMore(data.hasMore);
          setLoading(false);
          if (!data.__network) {
            const newData = await TicketCache.getTicketsNetwork(params);
            setTickets(newData.tickets);
            setHasMore(newData.hasMore);
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchTickets();
    }, 50);
    return () => clearTimeout(delayDebounceFn);
  }, [
    searchParam,
    tags,
    users,
    pageNumber,
    status,
    date,
    updatedAt,
    showAll,
    queueIds,
    withUnreadMessages,
  ]);

  return { tickets, loading, hasMore };
};

export default useTickets;
