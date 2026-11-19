import React, { useContext, useEffect, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";

import clsx from "clsx";
import { toast } from "react-toastify";

import { Paper, makeStyles } from "@material-ui/core";

import { AuthContext } from "../../context/Auth/AuthContext";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import ContactDrawer from "../ContactDrawer";
import MessageSearchDrawer from "../MessageSearchDrawer";
import MessageInput from "../MessageInputCustom/";
import MessagesList from "../MessagesList";
import { TagsContainer } from "../TagsContainer";
import TicketActionButtons from "../TicketActionButtonsCustom";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import { TicketCache } from "../../services/ticket-cache";

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },

  mainWrapper: {
    flex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    marginRight: -drawerWidth,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
  },
}));

const Ticket = (props) => {
  const params = useParams();

  const ticketId = props?.ticketId || params.ticketId;

  const history = useHistory();
  const location = useLocation();
  const classes = useStyles();

  const { user } = useContext(AuthContext);

  const [drawerOpen, setDrawerOpen] = useState(false);
  // Chamado #95: painel "Pesquisar mensagens" e mensagem a focar na lista
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const [ pendingMessages, setPendingMessages ] = useState([]);
  const smallMode = !!props.small;

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {
          // const { data } = await api.get("/tickets/u/" + ticketId);
          const data = await TicketCache.getTicketByUUID(ticketId);
          const { queueId } = data;
          const { queues, profile } = user;

          const queueAllowed = queues.find((q) => q.id === queueId);
          if (queueAllowed === undefined && profile !== "admin") {
            toast.error("Acesso não permitido");
            if (!smallMode) {
              history.push("/tickets");
            }
            return;
          }

          setContact(data.contact);
          setTicket(data);
          setLoading(false);

          if (!data.__network) {
            const network = await TicketCache.getTicketByUUIDNetwork(ticketId);
            setTicket(network);
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchTicket();
    }, 10);
    return () => clearTimeout(delayDebounceFn);
  }, [ticketId, user, history]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on("ready", () => socket.emit("joinChatBox", `${ticket.id}`));

    socket.on(`company-${companyId}-ticket`, (data) => {
      if (data.action === "update" && data.ticket.id === ticket.id) {
        setTicket(data.ticket);
      }

      if (data.action === "delete" && data.ticketId === ticket.id) {
        // toast.success("Ticket deleted sucessfully.");
        if (!smallMode) {
          history.push("/tickets");
        }
        else {
          toast.warn("O ticket foi deletado.");
        }
      }
    });

    socket.on(`company-${companyId}-contact`, (data) => {
      if (data.action === "update") {
        setContact((prevState) => {
          if (prevState.id === data.contact?.id) {
            return { ...prevState, ...data.contact };
          }
          return prevState;
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticketId, ticket, history, socketManager]);

  useEffect(() => {
    setPendingMessages([]);
    setSearchOpen(false);
  }, [ticketId])

  // Resultado da busca global clicado: a rota chega com a mensagem a focar
  // (ver TicketsContext). No modo small (sem rota própria) não se aplica.
  // Depois de usado, o state sai da rota para F5/Voltar não repetirem o salto.
  const routeState = props?.ticketId ? null : location.state;
  useEffect(() => {
    if (routeState?.focusMessageId) {
      setFocusTarget({
        messageId: routeState.focusMessageId,
        ticketId: routeState.focusTicketId,
      });
      history.replace(location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeState]);

  const handleDrawerOpen = () => {
    setSearchOpen(false);
    setDrawerOpen(true);
  };

  const handleToggleSearch = () => {
    setDrawerOpen(false);
    setSearchOpen((prev) => !prev);
  };

  const handleSearchSelect = (message) => {
    setFocusTarget({ messageId: message.id, ticketId: ticket.id });
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const renderTicketInfo = () => {
    if (ticket.user !== undefined) {
      return (
        <TicketInfo
          contact={contact}
          ticket={ticket}
          onClick={handleDrawerOpen}
        />
      );
    }
  };

  const renderMessagesList = () => {
    return (
      <>
        <MessagesList
          ticket={ticket}
          ticketId={ticket.id}
          isGroup={ticket.isGroup}
          pendingMessages={pendingMessages}
          setPendingMessages={setPendingMessages}
          focusTarget={focusTarget}
        ></MessagesList>
        <MessageInput 
          ticket={ticket}
          ticketId={ticket.id} 
          ticketStatus={ticket.status}
          pendingMessages={pendingMessages}
          setPendingMessages={setPendingMessages}
        />
      </>
    );
  };

  return (
    <div
      className={classes.root}
      id="drawer-container"
      // focar um campo do painel enquanto ele desliza faz o navegador rolar
      // este contêiner (overflow hidden) na horizontal, deslocando a conversa
      onScroll={(e) => (e.currentTarget.scrollLeft = 0)}
    >
      <Paper
        variant="outlined"
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen || searchOpen,
        })}
      >
        <TicketHeader loading={loading}>
          {renderTicketInfo()}
          <TicketActionButtons
            ticket={ticket}
            contact={contact}
            small={smallMode}
            onSearchClick={ticket.id ? handleToggleSearch : undefined}
            searchOpen={searchOpen}
          />
        </TicketHeader>
        <Paper>
          <TagsContainer ticket={ticket} />
        </Paper>
        <ReplyMessageProvider>{renderMessagesList()}</ReplyMessageProvider>
      </Paper>
      <ContactDrawer
        open={drawerOpen}
        handleDrawerClose={handleDrawerClose}
        contact={contact}
        loading={loading}
        ticket={ticket}
      />
      <MessageSearchDrawer
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        ticket={ticket}
        onSelectMessage={handleSearchSelect}
      />
    </div>
  );
};

export default Ticket;
