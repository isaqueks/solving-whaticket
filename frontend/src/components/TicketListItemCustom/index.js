import React, { useContext, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { format, isSameDay, parseISO } from "date-fns";
import { useHistory, useParams } from "react-router-dom";

import {
  Avatar,
  Badge,
  Box,
  Divider,
  IconButton,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { blue, green, grey } from "@material-ui/core/colors";
import { makeStyles } from "@material-ui/core/styles";
import { v4 as uuidv4 } from "uuid";

import AndroidIcon from "@material-ui/icons/Android";
import VisibilityIcon from "@material-ui/icons/Visibility";

import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import MarkdownWrapper from "../MarkdownWrapper";
import ContactTag from "../ContactTag";
import TicketMessagesDialog from "../TicketMessagesDialog";
import { MoreVert } from "@material-ui/icons";

const useStyles = makeStyles((theme) => ({
  ticket: {
    position: "relative",
    backgroundColor: "#FFF",
    borderRadius: 6,
    marginBottom: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    // Aumente o padding e a altura mínima para dar mais espaço
    padding: "4px 10px 8px 10px",
    minHeight: 90,
    "&:hover": {
      backgroundColor: "#f9f9f9",
      cursor: "pointer"
    },
  },
  pendingTicket: {
    cursor: "unset",
  },
  // Barra colorida lateral (cor da fila)
  ticketQueueColor: {
    flex: "none",
    width: 6,
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  contactNameWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: 5,
    marginBottom: 4,
  },
  contactLastMessage: {
    marginLeft: 5,
    fontSize: "0.9rem",
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'space-between'
  },
  newMessagesCount: {
    position: "absolute",
    alignSelf: "center",
    marginRight: 8,
    marginLeft: "auto",
    top: "10px",
    left: "20px",
    borderRadius: 0,
  },
  badgeStyle: {
    color: "white",
    backgroundColor: green[500],
  },
  secondaryContentSecond: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 4,
    marginLeft: 5,
    // Adiciona um "gap" para separar os badges
    gap: 4,
  },
  connectionTag: {
    background: "green",
    color: "#FFF",
    padding: "3px 7px",
    // fontWeight: "bold",
    borderRadius: 5,
    fontSize: "0.75rem",
    whiteSpace: "nowrap",
  },
  lastMessageTime: {
    color: "#333",
  },
  // Botões de ação (ACEITAR, FINALIZAR, REABRIR)
  acceptButton: {
    backgroundColor: "#FF4B4B",
    color: "#FFF",
    fontSize: "0.75rem",
    marginLeft: 8,
    padding: "5px 12px",
    minWidth: 90,
    "&:hover": {
      backgroundColor: "#d43b3b",
    },
  },
  wrapper140: {
    // width: '140px',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }
}));

const TicketListItemCustom = ({ ticket }) => {
  const classes = useStyles();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [ticketUser, setTicketUser] = useState(null);
  const [ticketQueueName, setTicketQueueName] = useState(null);
  const [ticketQueueColor, setTicketQueueColor] = useState(null);
  const [tag, setTag] = useState([]);
  const [whatsAppName, setWhatsAppName] = useState(null);
  const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
  const { ticketId } = useParams();
  const isMounted = useRef(true);
  const { setCurrentTicket } = useContext(TicketsContext);
  const { user } = useContext(AuthContext);
  const [verpreview] = useState(false);
  const { profile } = user;

  // Carrega dados do ticket
  useEffect(() => {
    if (ticket.userId && ticket.user) {
      setTicketUser(ticket.user?.name?.toUpperCase());
    }
    setTicketQueueName(ticket.queue?.name?.toUpperCase());
    setTicketQueueColor(ticket.queue?.color);

    if (ticket.whatsappId && ticket.whatsapp) {
      setWhatsAppName(ticket.whatsapp.name?.toUpperCase());
    }

    setTag(ticket?.tags);

    return () => {
      isMounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Função para fechar ticket
  const handleCloseTicket = async (id) => {
    setTag(ticket?.tags);
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
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

  // Função para reabrir ticket
  const handleReopenTicket = async (id) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
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

  // Função para aceitar ticket
  const handleAcepptTicket = async (id) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "open",
        userId: user?.id,
      });

      // Verifica setting para envio de saudação (opcional)
      let settingIndex;
      try {
        const { data } = await api.get("/settings/");
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
      await api.post(`/messages/${id}`, message);
    } catch (err) {
      toastError(err);
    }
  };

  // Seleciona o ticket
  const handleSelectTicket = (ticket) => {
    const code = uuidv4();
    const { id, uuid } = ticket;
    setCurrentTicket({ id, uuid, code });
  };

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const handleClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };
  const handleClose = (e) => {
    e.stopPropagation();
    setAnchorEl(null);
  };

  // Renderiza ícones informativos (exemplo: Chatbot)
  const renderTicketInfo = () => {
    return (
      <>
        {ticket.chatbot && (
          <Tooltip title="Chatbot">
            <AndroidIcon
              fontSize="small"
              style={{ color: grey[700], marginRight: 5 }}
            />
          </Tooltip>
        )}
      </>
    );
  };

  return (
    <>
      <TicketMessagesDialog
        open={openTicketMessageDialog}
        handleClose={() => setOpenTicketMessageDialog(false)}
        ticketId={ticket.id}
      />

      <Paper

        dense
        button
        onClick={(e) => {
          // if (ticket.status === "pending") return;
          handleSelectTicket(ticket);
        }}
        selected={ticketId && +ticketId === ticket.id}
        className={clsx(classes.ticket/*, {
          [classes.pendingTicket]: ticket.status === "pending",
        }*/)}
      >
        {/* Barra colorida da fila */}
        <Tooltip
          arrow
          placement="right"
          title={ticket.queue?.name?.toUpperCase() || "SEM FILA"}
        >
          <span
            style={{ backgroundColor: ticket.queue?.color || "#7C7C7C" }}
            className={classes.ticketQueueColor}
          ></span>
        </Tooltip>

        <ListItem
          disableGutters
        >

          {/* Avatar do contato */}
          <ListItemAvatar>
            <Avatar
              style={{
                marginLeft: 10,
                marginRight: 8,
                width: 52,
                height: 52,
                borderRadius: 8,
              }}
              src={ticket?.contact?.profilePicUrl}
            />
          </ListItemAvatar>

          {/* Texto principal */}
          <ListItemText
            disableTypography
            secondaryTypographyProps={{
              paddingLeft: 0
            }}
            primary={
              <div className={classes.contactNameWrapper}>
                <Typography noWrap component="span" variant="body2" color="textPrimary">
                  <strong>
                    {ticket.contact.name}
                  </strong>
                </Typography>
              </div>
            }
            secondary={
              <>
                {/* Última mensagem */}
                <Typography
                  className={classes.contactLastMessage}
                  noWrap
                  component="span"
                  variant="body2"
                  color="textSecondary"
                >
                  {ticket.lastMessage && !verpreview ? (
                    <span className={classes.wrapper140}>
                      <MarkdownWrapper>{ticket.lastMessage}</MarkdownWrapper>
                    </span>
                  ) : (
                    <MarkdownWrapper>---</MarkdownWrapper>
                  )}

                  {/* Horário da última mensagem no canto superior direito */}
                  {ticket.lastMessage && (
                    <Typography
                      className={classes.lastMessageTime}
                      component="span"
                      variant="body2"
                      color="textSecondary"
                    >
                      {isSameDay(parseISO(ticket.updatedAt), new Date())
                        ? format(parseISO(ticket.updatedAt), "HH:mm")
                        : format(parseISO(ticket.updatedAt), "dd/MM/yyyy")}
                    </Typography>
                  )}
                </Typography>
              </>
            }
          />

          {/* Ações à direita */}
          <ListItemSecondaryAction>
            {/* Quantidade de mensagens não lidas */}
            <Badge
              className={classes.newMessagesCount}
              badgeContent={ticket.unreadMessages}
              classes={{
                badge: classes.badgeStyle,
              }}
            />

            <div>
              <IconButton
                aria-label="more"
                id="long-button"
                aria-controls={open ? 'long-menu' : undefined}
                aria-expanded={open ? 'true' : undefined}
                aria-haspopup="true"
                onClick={handleClick}
              >
                <MoreVert />
              </IconButton>
              <Menu
                id="long-menu"
                MenuListProps={{
                  'aria-labelledby': 'long-button',
                }}
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                slotProps={{
                  paper: {
                    style: {
                      maxHeight: 48 * 4.5,
                      width: '20ch',
                    },
                  },
                }}
              >
                {/* Se estiver pendente, mostra "ACEITAR" */}
                {ticket.status === "pending" && (
                  <MenuItem
                    loading={loading}
                    onClick={(e) => (e.stopPropagation(),handleAcepptTicket(ticket.id))}
                  >
                    Aceitar Atendimento
                  </MenuItem>
                )}
                {/* Se não estiver fechado, mostra "FINALIZAR" */}
                {ticket.status !== "closed" && (
                  <MenuItem
                    loading={loading}
                    onClick={(e) => (e.stopPropagation(),handleCloseTicket(ticket.id))}
                  >
                    Finalizar Atendimento
                  </MenuItem>
                )}

                {/* Se estiver fechado, mostra "REABRIR" */}
                {ticket.status === "closed" && (
                  <MenuItem
                    loading={loading}
                    onClick={(e) => (e.stopPropagation(),handleReopenTicket(ticket.id))}
                  >
                    Reabrir Atendimento
                  </MenuItem>
                )}
                {/* Ícone de espiar conversa, se for admin */}
                {profile === "admin" && (
                  <MenuItem
                  onClick={(e) => (e.stopPropagation(),setOpenTicketMessageDialog(true))}
                  >
                    Espiar Conversa
                  </MenuItem>
                  // <Tooltip title="Espiar Conversa">
                  //   <VisibilityIcon
                  //     onClick={() => setOpenTicketMessageDialog(true)}
                  //     fontSize="small"
                  //     style={{
                  //       color: blue[700],
                  //       cursor: "pointer",
                  //       marginLeft: 10,
                  //       verticalAlign: "middle",
                  //     }}
                  //   />
                  // </Tooltip>
                )}
              </Menu>
            </div>
            
          </ListItemSecondaryAction>


        </ListItem>

        <div>

          {/* Badges (ex: conexão, usuário, fila, tags) */}
          <div className={classes.secondaryContentSecond}>
            {/* {ticket?.whatsapp?.name && (
              <Badge className={classes.connectionTag}>
                {ticket?.whatsapp?.name?.toUpperCase()}
              </Badge>
            )} */}
            {ticketUser && (
              <Badge
                style={{ backgroundColor: "#000" }}
                className={classes.connectionTag}
              >
                {ticketUser}
              </Badge>
            )}
            <Badge
              style={{
                backgroundColor: ticket.queue?.color || "#7c7c7c",
              }}
              className={classes.connectionTag}
            >
              {ticket.queue?.name?.toUpperCase() || "SEM FILA"}
            </Badge>

            {/* Se tiver tags personalizadas */}
            {tag?.map((tg) => {
              return (
                <ContactTag
                  tag={tg}
                  key={`ticket-contact-tag-${ticket.id}-${tg.id}`}
                />
              );
            })}
          </div>

        </div>

      </Paper>

      {/* Divider entre os itens */}
      {/* <Divider style={{ marginLeft: 60 }} /> */}
    </>
  );
};

export default TicketListItemCustom;
