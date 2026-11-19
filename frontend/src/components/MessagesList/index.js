import React, { useState, useEffect, useLayoutEffect, useReducer, useRef, useContext, useMemo } from "react";

import { isSameDay, parseISO, format } from "date-fns";
import clsx from "clsx";

import { green } from "@material-ui/core/colors";
import {
  Button,
  CircularProgress,
  Divider,
  Fab,
  IconButton,
  Tooltip,
  makeStyles,
} from "@material-ui/core";
import { alpha, useTheme } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import {
  AccessTime,
  Block,
  Done,
  DoneAll,
  ExpandMore,
  GetApp,
  KeyboardArrowDown,
  CheckCircle,
  RadioButtonUnchecked,
} from "@material-ui/icons";

import MarkdownWrapper from "../MarkdownWrapper";
import ModalImageCors from "../ModalImageCors";
import MessageOptionsMenu from "../MessageOptionsMenu";
import whatsBackground from "../../assets/wpp-bg.png"//"../../assets/wa-background.png";
import LocationPreview from "../LocationPreview";
import whatsBackgroundDark from "../../assets/wa-background-dark.png"; //DARK MODE PLW DESIGN//
import VCardPreview from "../VCardPreview";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  messagesListWrapper: {
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    width: "100%",
    minWidth: 300,
    minHeight: 200,
  },

  messagesList: {
    backgroundImage: theme.mode === 'light' ? `url(${whatsBackground})` : `url(${whatsBackgroundDark})`, //DARK MODE PLW DESIGN//
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    padding: "20px 20px 20px 20px",
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },

  circleLoading: {
    color: green[500],
    position: "absolute",
    opacity: "70%",
    top: 0,
    left: "50%",
    marginTop: 12,
  },

  circleLoadingBottom: {
    top: "auto",
    bottom: 0,
    marginTop: 0,
    marginBottom: 12,
  },

  // Chamado #95: botão para voltar às mensagens mais recentes quando a lista
  // está mostrando um trecho antigo da conversa (após pular para um resultado)
  jumpToLatest: {
    position: "absolute",
    right: 28,
    bottom: 16,
    zIndex: 2,
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.background.paper,
    "&:hover": { backgroundColor: theme.palette.background.default },
  },

  // espaço livre no fim da lista para o botão acima não cobrir o último balão
  messagesListWithJump: {
    paddingBottom: 72,
  },

  messageLeft: {
    marginRight: 'auto',
    width: 'fit-content',
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: "#ffffff",
    color: "#303030",
    alignSelf: "flex-start",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3",
  },

  quotedContainerLeft: {
    margin: "-3px -80px 6px -6px",
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsg: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  quotedSideColorLeft: {
    flex: "none",
    width: "4px",
    backgroundColor: "#6bcbef",
  },

  messageRight: {
    marginLeft: 'auto',
    width: 'fit-content',
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: "#dcf8c6",
    color: "#303030",
    alignSelf: "flex-end",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3",
  },

  quotedContainerRight: {
    margin: "-3px -80px 6px -6px",
    overflowY: "hidden",
    backgroundColor: "#cfe9ba",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsgRight: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    whiteSpace: "pre-wrap",
  },

  quotedSideColorRight: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },

  messageActionsButton: {
    display: "none",
    position: "relative",
    color: "#999",
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
  },

  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },

  textContentItem: {
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  textContentItemEdited: {
    overflowWrap: "break-word",
    padding: "3px 120px 6px 6px",
  },

  textContentItemDeleted: {
    fontStyle: "italic",
    color: "rgba(0, 0, 0, 0.36)",
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  messageMedia: {
    objectFit: "cover",
    width: 250,
    height: 200,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  timestamp: {
    fontSize: 11,
    position: "absolute",
    bottom: 0,
    right: 5,
    color: "#999",
  },

  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "110px",
    backgroundColor: "#e1f3fb",
    margin: "10px",
    borderRadius: "10px",
    boxShadow: "0 1px 1px #b3b3b3",
  },

  dailyTimestampText: {
    color: "#808888",
    padding: 8,
    alignSelf: "center",
    marginLeft: "0px",
  },

  ackIcons: {
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  deletedIcon: {
    fontSize: 18,
    verticalAlign: "middle",
    marginRight: 4,
  },

  ackDoneAllIcon: {
    color: green[500],
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10,
  },
}));

const useSelectStyles = makeStyles((theme) => ({
  messageWrapper: {
    display: "grid",
    gridTemplateColumns: '40px 1fr',
    width: "100%",
    "&:hover .message-checkbox": {
      opacity: 0.7,
    },
  },
  messageCheckbox: {
    opacity: 0,
    transition: "opacity 0.2s ease-in-out",
    cursor: "pointer",
    zIndex: 10,
    padding: "4px",
    display: 'grid',
    "&.visible": {
      opacity: 1,
    },
    "&.selected": {
      opacity: 1,
      color: "#00bfa5",
    },
    '& *': {
      display: 'grid',
      margin: 'auto'
    }
  },
  selectedMessage: {
    backgroundColor: "rgba(0, 191, 165, 0.08) !important",
    "&::before": {
      content: '""',
      position: "absolute",
      left: "-20px",
      top: 0,
      bottom: 0,
      width: "4px",
      backgroundColor: "#00bfa5",
      borderRadius: "0 2px 2px 0",
    },
  },
  messageContent: {
  },
}));

const ACK_SENDING = 0;

const reducer = (state, action) => {
  // LOAD_MESSAGES: mais antigas, entram no início; APPEND_MESSAGES (chamado
  // #95): mais novas (rolando para baixo num trecho antigo), entram no fim.
  // As que já estão na lista só são atualizadas.
  if (action.type === "LOAD_MESSAGES" || action.type === "APPEND_MESSAGES") {
    const next = [...state];
    const newMessages = [];

    action.payload.forEach((message) => {
      const messageIndex = next.findIndex((m) => m.id === message.id);
      if (messageIndex !== -1) {
        next[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });

    return action.type === "LOAD_MESSAGES"
      ? [...newMessages, ...next]
      : [...next, ...newMessages];
  }

  // Chamado #95: troca a lista inteira (janela em volta de uma mensagem)
  if (action.type === "SET_MESSAGES") {
    return [...action.payload];
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

// Id da mensagem original que uma linha de edição (isEdited) sobrescreve.
const getEditedTargetId = (msg) => {
  try {
    const raw = JSON.parse(msg.dataJson);
    return (
      raw?.message?.editedMessage?.message?.protocolMessage?.key?.id ||
      raw?.message?.protocolMessage?.key?.id ||
      null
    );
  } catch {
    return null;
  }
};

// Maps a message id to the most recent edited message that overwrites it.
const buildOverwrittenMessages = (messages) => {
  const map = new Map();
  for (const msg of messages) {
    if (!msg.isEdited) continue;
    const targetId = getEditedTargetId(msg);
    if (!targetId) continue;
    const existing = map.get(targetId);
    if (!existing || new Date(msg.createdAt) > new Date(existing.createdAt)) {
      map.set(targetId, msg);
    }
  }
  return map;
};

function MessageSelect({
  children,
  isSelectionEnabled,
  selectedList,
  setSelectedList,
  message
}) {

  const classes = useSelectStyles();

  const isSelected = !!selectedList.find(msg => msg.id === message.id);

  const handleSelect = (e) => {
    e.stopPropagation();
    if (isSelected) {
      setSelectedList(selectedList.filter(({ id }) => id !== message.id));
    } else {
      if (selectedList.length >= 6) 
        return;
      setSelectedList([...selectedList, message]);
    }
  };

  const handleMessageClick = (e) => {
    if (isSelectionEnabled) {
      e.preventDefault();
      handleSelect(e);
    }
  };

  if (!isSelectionEnabled) {
    return <>{children}</>;
  }

  return (
    <div
      className={`${classes.messageWrapper} ${isSelected ? classes.selectedMessage : ''}`}
      onClick={handleMessageClick}
    >
      <div
        className={`${classes.messageCheckbox} message-checkbox ${isSelectionEnabled ? 'visible' : ''
          } ${isSelected ? 'selected' : ''}`}
        onClick={handleSelect}
      >
        {isSelected ? (
          <CheckCircle style={{ fontSize: 22, color: "#00bfa5" }} />
        ) : (
          <RadioButtonUnchecked style={{ fontSize: 22, color: "#54656f" }} />
        )}
      </div>
      <div className={classes.messageContent}>
        {children}
      </div>
    </div>
  );
}

const MessagesList = ({
  ticket,
  ticketId,
  isGroup,
  pendingMessages = [],
  setPendingMessages = () => 0,
  // Chamado #95: { messageId, ticketId } — pular até essa mensagem (cada
  // pedido é um objeto novo: clicar de novo no mesmo resultado salta de novo)
  focusTarget = null,
  // allowSelection = false,
  // selection = [], 
  // setSelection = (arr) => {} 
}) => {
  const classes = useStyles();
  const theme = useTheme();

  const [messagesList, dispatch] = useReducer(reducer, []);
  const [hasMore, setHasMore] = useState(false);
  // Chamado #95: há mensagens mais novas que as carregadas (a lista está num
  // trecho antigo da conversa, depois de pular para um resultado da busca)
  const [hasNewer, setHasNewer] = useState(false);
  // false | "latest" | "older" | "newer" | "around"
  const [loading, setLoading] = useState(false);
  const [scrollRequest, setScrollRequest] = useState(0);

  const [selectedMessage, setSelectedMessage] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);
  const currentTicketId = useRef(ticketId);
  const loadingRef = useRef(false);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const socketManager = useContext(SocketContext);
  const listRef = useRef();

  const messagesRef = useRef(messagesList);
  messagesRef.current = messagesList;
  const hasNewerRef = useRef(false);
  // cada carga ganha um id; resposta de carga substituída (troca de conversa,
  // novo salto, "ir para as mais recentes") é descartada
  const requestIdRef = useRef(0);
  const loadedTicketRef = useRef();
  const handledFocusRef = useRef(null);
  const pendingScrollRef = useRef(null);
  const pendingCountRef = useRef(pendingMessages.length);

  const {
    isForwarding,
    setIsForwarding,
    selectedForwardMessages,
    setSelectedForwardMessages
  } = useContext(ReplyMessageContext);

  const updateHasNewer = (value) => {
    hasNewerRef.current = value;
    setHasNewer(value);
  };

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  const startRequest = (kind) => {
    const requestId = ++requestIdRef.current;
    loadingRef.current = true;
    setLoading(kind);
    return requestId;
  };

  const isCurrentRequest = (requestId) => requestId === requestIdRef.current;

  const finishRequest = (requestId) => {
    if (!isCurrentRequest(requestId)) return;
    loadingRef.current = false;
    setLoading(false);
  };

  // Mensagens mais recentes (como sempre foi ao abrir a conversa; também ao
  // voltar do histórico para o fim). A lista é zerada antes de pedir: o que
  // chegar pelo socket enquanto isso entra no fim e a resposta é mesclada.
  const loadLatest = async () => {
    if (ticketId === undefined) return;
    const requestId = startRequest("latest");
    dispatch({ type: "RESET" });
    updateHasNewer(false);
    try {
      const { data } = await api.get("/messages/" + ticketId, {
        params: { pageNumber: 1 },
      });
      if (!isCurrentRequest(requestId)) return;

      dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
      setHasMore(!!data.hasMore);
      finishRequest(requestId);

      if (data.messages.length > 1) {
        scrollToBottom();
      }
    } catch (err) {
      if (!isCurrentRequest(requestId)) return;
      finishRequest(requestId);
      toastError(err);
    }
  };

  // Mais antigas que a primeira carregada (rolando para cima)
  const loadOlder = async () => {
    const first = messagesRef.current[0];
    if (!first || ticketId === undefined) return;
    const requestId = startRequest("older");
    try {
      const { data } = await api.get("/messages/" + ticketId, {
        params: { beforeId: first.id },
      });
      if (!isCurrentRequest(requestId)) return;

      dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
      setHasMore(!!data.hasMore && data.messages.length > 0);
      finishRequest(requestId);
    } catch (err) {
      if (!isCurrentRequest(requestId)) return;
      finishRequest(requestId);
      toastError(err);
    }
  };

  // Mais novas que a última carregada (rolando para baixo num trecho antigo)
  const loadNewer = async () => {
    const list = messagesRef.current;
    const last = list[list.length - 1];
    if (!last || ticketId === undefined) return;
    const requestId = startRequest("newer");
    try {
      const { data } = await api.get("/messages/" + ticketId, {
        params: { afterId: last.id },
      });
      if (!isCurrentRequest(requestId)) return;

      dispatch({ type: "APPEND_MESSAGES", payload: data.messages });
      updateHasNewer(!!data.hasNewer && data.messages.length > 0);
      finishRequest(requestId);
    } catch (err) {
      if (!isCurrentRequest(requestId)) return;
      finishRequest(requestId);
      toastError(err);
    }
  };

  // Janela em volta de uma mensagem. Devolve as mensagens carregadas, ou null
  // se a carga foi substituída por outra no meio do caminho. Erros sobem.
  const loadAround = async (messageId) => {
    const requestId = startRequest("around");
    let data;
    try {
      ({ data } = await api.get("/messages/" + ticketId, {
        params: { aroundId: messageId },
      }));
    } catch (err) {
      if (!isCurrentRequest(requestId)) return null;
      finishRequest(requestId);
      throw err;
    }
    if (!isCurrentRequest(requestId)) return null;

    dispatch({ type: "SET_MESSAGES", payload: data.messages });
    setHasMore(!!data.hasMore);
    updateHasNewer(!!data.hasNewer);
    finishRequest(requestId);
    return data.messages;
  };

  // Chamado #95: pula até a mensagem. Se já está carregada só rola até ela;
  // senão carrega a janela em volta dela. O resultado da busca pode ser a
  // mensagem original ou uma linha de edição: o balão exibido é o da
  // mensagem original com o id da edição mais recente (overwrittenMessages).
  const jumpToMessage = async (targetId) => {
    if (ticketId === undefined) return;
    // não achou: avisa e cai para o carregamento normal (mais recentes)
    const fail = () => {
      toast.warn(i18n.t("messageSearch.notFound"));
      loadLatest();
    };

    try {
      let list = messagesRef.current;
      let target = list.find((m) => m.id === targetId);
      if (!target) {
        list = await loadAround(targetId);
        if (!list) return;
        target = list.find((m) => m.id === targetId);
        if (!target) return fail();
      }

      let baseId = targetId;
      if (target.isEdited) {
        baseId = getEditedTargetId(target);
        if (!baseId) return fail();
        if (!list.some((m) => m.id === baseId)) {
          list = await loadAround(baseId);
          if (!list) return;
          if (!list.some((m) => m.id === baseId)) return fail();
        }
      }

      const overwritten = buildOverwrittenMessages(list).get(baseId);
      pendingScrollRef.current = overwritten ? overwritten.id : baseId;
      setScrollRequest((n) => n + 1);
    } catch (err) {
      // mensagem não encontrada (404) ou erro
      console.error(err);
      fail();
    }
  };

  // Rola centralizando a mensagem pedida (a lista já está renderizada quando
  // o pedido chega). Layout effect para não pintar a posição errada antes.
  useLayoutEffect(() => {
    const renderedId = pendingScrollRef.current;
    const container = listRef.current;
    pendingScrollRef.current = null;
    if (!renderedId || !container) return;

    const element = Array.from(
      container.querySelectorAll("[data-message-id]")
    ).find((el) => el.getAttribute("data-message-id") === renderedId);
    if (!element) return;

    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    container.scrollTop +=
      elementRect.top -
      containerRect.top -
      Math.max(16, (container.clientHeight - elementRect.height) / 2);
    // pisca o balão (contorno âmbar) sem re-renderizar a lista
    const base = { boxShadow: "0 1px 1px #b3b3b3", filter: "none" };
    const lit = {
      boxShadow: `0 0 0 4px ${alpha(theme.palette.warning.main, 0.85)}`,
      filter: "brightness(0.92)",
    };
    element.animate(
      [base, { ...lit, offset: 0.2 }, { ...base, offset: 0.45 }, { ...lit, offset: 0.7 }, base],
      { duration: 2000, easing: "ease-in-out" }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRequest]);

  // Troca de conversa e pedidos de salto
  useEffect(() => {
    const wantsFocus =
      ticketId !== undefined &&
      !!focusTarget &&
      focusTarget.ticketId === ticketId &&
      handledFocusRef.current !== focusTarget;

    if (loadedTicketRef.current !== ticketId || ticketId === undefined) {
      loadedTicketRef.current = ticketId;
      currentTicketId.current = ticketId;
      requestIdRef.current++;
      loadingRef.current = false;
      pendingScrollRef.current = null;
      dispatch({ type: "RESET" });
      messagesRef.current = [];
      setHasMore(false);
      updateHasNewer(false);
      setSelectedForwardMessages([]);
      setIsForwarding(false);

      if (ticketId === undefined) {
        setLoading("latest");
        return;
      }
      if (!wantsFocus) {
        loadLatest();
      }
    }

    if (wantsFocus) {
      handledFocusRef.current = focusTarget;
      jumpToMessage(focusTarget.messageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, focusTarget]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on("ready", () => socket.emit("joinChatBox", `${ticket.id}`));

    socket.on(`company-${companyId}-appMessage`, (data) => {
      if (data.action === "create" && data.message.ticketId === currentTicketId.current) {
        // num trecho antigo da conversa a mensagem nova não entra no fim da
        // lista (deixaria um buraco); ela vem ao rolar para baixo ou no botão
        // "ir para as mais recentes"
        if (hasNewerRef.current) return;
        dispatch({ type: "ADD_MESSAGE", payload: data.message });
        scrollToBottom();
      }

      if (data.action === "update" && data.message.ticketId === currentTicketId.current) {
        dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticketId, ticket, socketManager]);

  useEffect(() => {
    const sentNew = pendingMessages.length > pendingCountRef.current;
    pendingCountRef.current = pendingMessages.length;

    if (hasNewerRef.current) {
      // a usuária mandou mensagem enquanto via o histórico: volta para o fim
      if (sentNew) loadLatest();
    } else if (pendingMessages.length > 0) {
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

  }, [messagesList, pendingMessages]);

  // Maps a message id to the most recent edited message that overwrites it.
  // Computed once per messagesList change (O(edited)) instead of parsing every
  // edited message's dataJson for every rendered message on every render.
  const overwrittenMessages = useMemo(
    () => buildOverwrittenMessages(messagesList),
    [messagesList]
  );

  const handleScroll = (e) => {
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;

    // mantém o scroll fora do 0 para o navegador preservar a posição quando
    // as mensagens antigas entram no topo
    if (hasMore && scrollTop === 0) {
      container.scrollTop = 1;
    }

    if (loadingRef.current) {
      return;
    }

    if (hasMore && scrollTop < 50) {
      loadOlder();
    } else if (hasNewer && scrollHeight - (scrollTop + clientHeight) < 50) {
      loadNewer();
    }
  };

  const handleOpenMessageOptionsMenu = (e, message) => {
    setAnchorEl(e.currentTarget);
    setSelectedMessage(message);
  };

  const handleCloseMessageOptionsMenu = (e) => {
    setAnchorEl(null);
  };

  const checkMessageMedia = (message) => {
    if (message.mediaType === "locationMessage" && message.body.split('|').length >= 2) {
      let locationParts = message.body.split('|')
      let imageLocation = locationParts[0]
      let linkLocation = locationParts[1]

      let descriptionLocation = null

      if (locationParts.length > 2)
        descriptionLocation = message.body.split('|')[2]

      return <LocationPreview image={imageLocation} link={linkLocation} description={descriptionLocation} />
    }
    else
      if (message.mediaType === "contactMessage") {
        let array = message.body.split("\n");
        let obj = [];
        let contact = "";
        for (let index = 0; index < array.length; index++) {
          const v = array[index];
          let values = v.split(":");
          for (let ind = 0; ind < values.length; ind++) {
            if (values[ind].indexOf("+") !== -1) {
              obj.push({ number: values[ind] });
            }
            if (values[ind].indexOf("FN") !== -1) {
              contact = values[ind + 1];
            }
          }
        }
        return <VCardPreview contact={contact} numbers={obj.length > 0 ? obj[0].number : ""} />
      }
      else if (message.mediaType === "image") {
        return <ModalImageCors imageUrl={message.mediaUrl} />;
      } else if (message.mediaType === "audio") {
        if (isIOS) {
          message.mediaUrl = message.mediaUrl.replace("ogg", "mp3");

          return (
            <audio controls>
              <source src={message.mediaUrl} type="audio/mp3"></source>
            </audio>
          );
        } else {

          return (
            <audio controls>
              <source src={message.mediaUrl} type="audio/ogg"></source>
            </audio>
          );
        }
      } else if (message.mediaType === "video") {
        return (
          <video
            className={classes.messageMedia}
            src={message.mediaUrl}
            controls
          />
        );
      } else {
        return (
          <>
            <div className={classes.downloadMedia}>
              <Button
                startIcon={<GetApp />}
                color="primary"
                variant="outlined"
                target="_blank"
                href={message.mediaUrl}
              >
                Download
              </Button>
            </div>
            <Divider />
          </>
        );
      }
  };

  const renderMessageAck = (message) => {
    if (message.ack === 0) {
      return <AccessTime fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 1) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 2) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 3) {
      return <DoneAll fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 4 || message.ack === 5) {
      return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} style={{ color: '#0377FC' }} />;
    }
  };

  const renderDailyTimestamps = (message, index) => {
    if (index === 0) {
      return (
        <span
          className={classes.dailyTimestamp}
          key={`timestamp-${message.id}`}
        >
          <div className={classes.dailyTimestampText}>
            {format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
          </div>
        </span>
      );
    }
    if (index < messagesList.length - 1) {
      let messageDay = parseISO(messagesList[index].createdAt);
      let previousMessageDay = parseISO(messagesList[index - 1].createdAt);

      if (!isSameDay(messageDay, previousMessageDay)) {
        return (
          <span
            className={classes.dailyTimestamp}
            key={`timestamp-${message.id}`}
          >
            <div className={classes.dailyTimestampText}>
              {format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
            </div>
          </span>
        );
      }
    }
  };

  const renderNumberTicket = (message, index) => {
    if (index < messagesList.length && index > 0) {

      let messageTicket = message.ticketId;
      let connectionName = message.ticket?.whatsapp?.name;
      let previousMessageTicket = messagesList[index - 1].ticketId;

      if (messageTicket !== previousMessageTicket) {
        return (
          <center>
            <div className={classes.ticketNunberClosed}>
              Conversa encerrada: {format(parseISO(messagesList[index - 1].createdAt), "dd/MM/yyyy HH:mm:ss")}
            </div>

            <div className={classes.ticketNunberOpen}>
              Conversa iniciada: {format(parseISO(message.createdAt), "dd/MM/yyyy HH:mm:ss")}
            </div>
          </center>
        );
      }
    }
  };

  const renderMessageDivider = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageUser = messagesList[index].fromMe;
      let previousMessageUser = messagesList[index - 1].fromMe;

      if (messageUser !== previousMessageUser) {
        return (
          <span style={{ marginTop: 16 }} key={`divider-${message.id}`}></span>
        );
      }
    }
  };

  const renderQuotedMessage = (message) => {
    return (
      <div
        className={clsx(classes.quotedContainerLeft, {
          [classes.quotedContainerRight]: message.fromMe,
        })}
      >
        <span
          className={clsx(classes.quotedSideColorLeft, {
            [classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
          })}
        ></span>
        <div className={classes.quotedMsg}>
          {!message.quotedMsg?.fromMe && (
            <span className={classes.messageContactName}>
              {message.quotedMsg?.contact?.name}
            </span>
          )}

          {message.quotedMsg.mediaType === "audio"
            && (
              <div className={classes.downloadMedia}>
                <audio controls>
                  <source src={message.quotedMsg.mediaUrl} type="audio/ogg"></source>
                </audio>
              </div>
            )
          }
          {message.quotedMsg.mediaType === "video"
            && (
              <video
                className={classes.messageMedia}
                src={message.quotedMsg.mediaUrl}
                controls
              />
            )
          }
          {message.quotedMsg.mediaType === "application"
            && (
              <div className={classes.downloadMedia}>
                <Button
                  startIcon={<GetApp />}
                  color="primary"
                  variant="outlined"
                  target="_blank"
                  href={message.quotedMsg.mediaUrl}
                >
                  Download
                </Button>
              </div>
            )
          }

          {message.quotedMsg.mediaType === "image"
            && (
              <ModalImageCors imageUrl={message.quotedMsg.mediaUrl} />)
            || message.quotedMsg?.body}

        </div>
      </div>
    );
  };


  const renderMessages = () => {
    if (messagesList.length > 0) {
      const viewMessagesList = [...messagesList, ...pendingMessages].map((message, index) => {

        if (message.isEdited) {
          return undefined;
        }

        const overwritten = overwrittenMessages.get(message.id);

        if (overwritten) {
          message = {
            ...message,
            id: overwritten.id,
            isEdited: true,
            body: overwritten.body,
          }
        }

        if (message.mediaType === "call_log") {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderNumberTicket(message, index)}
              {renderMessageDivider(message, index)}
              <div
                className={classes.messageCenter}
                data-message-id={message.id}
              >
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {isGroup && (
                  <span className={classes.messageContactName}>
                    {message.contact?.name}
                  </span>
                )}
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 17" width="20" height="17">
                    <path fill="#df3333" d="M18.2 12.1c-1.5-1.8-5-2.7-8.2-2.7s-6.7 1-8.2 2.7c-.7.8-.3 2.3.2 2.8.2.2.3.3.5.3 1.4 0 3.6-.7 3.6-.7.5-.2.8-.5.8-1v-1.3c.7-1.2 5.4-1.2 6.4-.1l.1.1v1.3c0 .2.1.4.2.6.1.2.3.3.5.4 0 0 2.2.7 3.6.7.2 0 1.4-2 .5-3.1zM5.4 3.2l4.7 4.6 5.8-5.7-.9-.8L10.1 6 6.4 2.3h2.5V1H4.1v4.8h1.3V3.2z"></path>
                  </svg> <span>Chamada de voz/vídeo perdida às {format(parseISO(message.createdAt), "HH:mm")}</span>
                </div>
              </div>
            </React.Fragment>
          );
        }

        if (!message.fromMe) {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderNumberTicket(message, index)}
              {renderMessageDivider(message, index)}
              <MessageSelect selectedList={selectedForwardMessages} setSelectedList={setSelectedForwardMessages} isSelectionEnabled={isForwarding} message={message}>
                <div
                  className={classes.messageLeft}
                  data-message-id={message.id}
                >
                  <IconButton
                    variant="contained"
                    size="small"
                    id="messageActionsButton"
                    disabled={message.isDeleted}
                    className={classes.messageActionsButton}
                    onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                  >
                    <ExpandMore />
                  </IconButton>
                  {isGroup && (
                    <span className={classes.messageContactName}>
                      {message.contact?.name}
                    </span>
                  )}

                  {/* aviso de mensagem apagado pelo contato */}
                  {message.isDeleted && (
                    <div>
                      <span className={"message-deleted"}
                      >Essa mensagem foi apagada pelo contato &nbsp;
                        <Block
                          color="error"
                          fontSize="small"
                          className={classes.deletedIcon}
                        />
                      </span>
                    </div>
                  )}

                  {(message.mediaUrl || message.mediaType === "locationMessage" || message.mediaType === "vcard" || message.mediaType === "contactMessage"
                    //|| message.mediaType === "multi_vcard" 
                  ) && checkMessageMedia(message)}
                  <div className={classes.textContentItem}>
                    {message.quotedMsg && renderQuotedMessage(message)}
                    <MarkdownWrapper>
                      {message.mediaType === "locationMessage" || message.mediaType === "contactMessage" ? null : message.body}
                    </MarkdownWrapper>
                    <span className={classes.timestamp}>
                      {message.isEdited ? 'Editada' : ''}&nbsp;{format(parseISO(message.createdAt), "HH:mm")}
                    </span>
                  </div>
                </div>
              </MessageSelect>
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderNumberTicket(message, index)}
              {renderMessageDivider(message, index)}
              <MessageSelect selectedList={selectedForwardMessages} setSelectedList={setSelectedForwardMessages} isSelectionEnabled={isForwarding} message={message}>
                <div
                  className={classes.messageRight}
                  style={message.isEdited ? { minWidth: '170px' } : {}}
                  data-message-id={message.id}
                >
                  <IconButton
                    variant="contained"
                    size="small"
                    id="messageActionsButton"
                    disabled={message.isDeleted}
                    className={classes.messageActionsButton}
                    onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                  >
                    <ExpandMore />
                  </IconButton>
                  {(message.mediaUrl || message.mediaType === "locationMessage" || message.mediaType === "vcard" || message.mediaType === "contactMessage"
                    //|| message.mediaType === "multi_vcard" 
                  ) && checkMessageMedia(message)}
                  <div
                    className={clsx(classes.textContentItem, {
                      [classes.textContentItemDeleted]: message.isDeleted,
                    })}
                  >
                    {message.isDeleted && (
                      <Block
                        color="disabled"
                        fontSize="small"
                        className={classes.deletedIcon}
                      />
                    )}
                    {message.quotedMsg && renderQuotedMessage(message)}
                    <MarkdownWrapper>{message.body}</MarkdownWrapper>
                    <span className={classes.timestamp}>
                      {message.isEdited ? 'Editada' : ''}&nbsp;{format(parseISO(message.createdAt), "HH:mm")}
                      {renderMessageAck(message)}
                    </span>
                  </div>
                </div>
              </MessageSelect>
            </React.Fragment>
          );
        }
      });
      return viewMessagesList;
    } else {
      return <div>Diga olá para seu novo contato!</div>;
    }
  };

  return (
    <div className={classes.messagesListWrapper}>
      <MessageOptionsMenu
        message={selectedMessage}
        anchorEl={anchorEl}
        menuOpen={messageOptionsMenuOpen}
        handleClose={handleCloseMessageOptionsMenu}
      />
      <div
        id="messagesList"
        ref={listRef}
        className={clsx(classes.messagesList, {
          [classes.messagesListWithJump]: hasNewer,
        })}
        onScroll={handleScroll}
      >
        {messagesList.length > 0 ? renderMessages() : []}
      </div>
      {loading && (
        <div>
          <CircularProgress
            className={clsx(classes.circleLoading, {
              [classes.circleLoadingBottom]: loading === "newer",
            })}
          />
        </div>
      )}
      {hasNewer && (
        <Tooltip title={i18n.t("messageSearch.jumpToLatest")} placement="left">
          <Fab
            size="small"
            className={classes.jumpToLatest}
            onClick={() => loadLatest()}
            aria-label={i18n.t("messageSearch.jumpToLatest")}
          >
            <KeyboardArrowDown />
          </Fab>
        </Tooltip>
      )}
    </div>
  );
};

export default MessagesList;