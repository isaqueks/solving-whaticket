import { useContext, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";

import { AuthContext } from "../../context/Auth/AuthContext";

/**
 * Estado e handlers do TicketsManagerTabs: abas (open/closed/search), sub-abas
 * de lidos/não lidos, contadores dos badges, filtros (fila/tags/usuários),
 * busca com debounce e a persistência de `showAllTickets` no localStorage.
 * Sem I/O de rede — o componente só monta a UI a partir do que este hook expõe.
 */
export const useTicketsTabs = () => {
  const history = useHistory();
  const { user } = useContext(AuthContext);

  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  const [tabOpen, setTabOpen] = useState("read");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);

  // Carrega o valor do localStorage ou usa false como padrão
  const [showAllTickets, setShowAllTickets] = useState(() => {
    const saved = localStorage.getItem("showAllTickets");
    return saved ? JSON.parse(saved) : false;
  });

  const searchInputRef = useRef();

  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const userQueueIds = user.queues.map((q) => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  useEffect(() => {
    if (user.profile.toUpperCase() === "ADMIN") {
      const saved = localStorage.getItem("showAllTickets");
      const savedValue = saved ? JSON.parse(saved) : true;
      setShowAllTickets(savedValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salva no localStorage sempre que showAllTickets mudar
  useEffect(() => {
    localStorage.setItem("showAllTickets", JSON.stringify(showAllTickets));
  }, [showAllTickets]);

  useEffect(() => {
    if (tab === "search") {
      searchInputRef.current.focus();
    }
  }, [tab]);

  let searchTimeout;

  const handleSearch = (e) => {
    const searchedTerm = e.target.value.toLowerCase();

    clearTimeout(searchTimeout);

    if (searchedTerm === "") {
      setSearchParam(searchedTerm);
      setTab("open");
      return;
    }

    searchTimeout = setTimeout(() => {
      setSearchParam(searchedTerm);
    }, 500);
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const applyPanelStyle = (status) => {
    if (tabOpen !== status) {
      return { width: 0, height: 0 };
    }
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = (selecteds) => {
    const tags = selecteds.map((t) => t.id);
    setSelectedTags(tags);
  };

  const handleSelectedUsers = (selecteds) => {
    const users = selecteds.map((t) => t.id);
    setSelectedUsers(users);
  };

  return {
    user,
    searchParam,
    tab,
    tabOpen,
    newTicketModalOpen,
    setNewTicketModalOpen,
    showAllTickets,
    setShowAllTickets,
    searchInputRef,
    openCount,
    setOpenCount,
    pendingCount,
    setPendingCount,
    selectedQueueIds,
    setSelectedQueueIds,
    selectedTags,
    selectedUsers,
    handleSearch,
    handleChangeTab,
    handleChangeTabOpen,
    applyPanelStyle,
    handleCloseOrOpenTicket,
    handleSelectedTags,
    handleSelectedUsers,
  };
};
