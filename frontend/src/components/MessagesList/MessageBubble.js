import React from "react";

import { isSameDay, parseISO, format } from "date-fns";
import clsx from "clsx";

import { green } from "@material-ui/core/colors";
import { IconButton, makeStyles } from "@material-ui/core";
import {
  AccessTime,
  Block,
  Done,
  DoneAll,
  ExpandMore,
} from "@material-ui/icons";

import MarkdownWrapper from "../MarkdownWrapper";
import { MessageMediaPreview } from "./MessageMediaPreview";
import { MessageSelect } from "./MessageSelect";
import { QuotedMessage } from "./QuotedMessage";
import { useSharedMessageStyles } from "./sharedStyles";

const useStyles = makeStyles((theme) => ({
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

  messageActionsButton: {
    display: "none",
    position: "relative",
    color: "#999",
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
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
}));

/**
 * Renderização de UMA mensagem da conversa (era o corpo do map do
 * renderMessages + helpers do index.js): separador diário, divisor de ticket,
 * divisor de autor e a bolha em si (call_log, recebida ou enviada), incluindo
 * citação (QuotedMessage) e mídia (MessageMediaPreview). JSX e classes
 * idênticos ao original.
 */
export const MessageBubble = ({
  message,
  index,
  messagesList,
  isGroup,
  lastMessageRef,
  isForwarding,
  selectedForwardMessages,
  setSelectedForwardMessages,
  handleOpenMessageOptionsMenu,
}) => {
  const classes = useStyles();
  const sharedClasses = useSharedMessageStyles();

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
    if (index === messagesList.length - 1) {
      return (
        <div
          key={`ref-${message.createdAt}`}
          ref={lastMessageRef}
          style={{ float: "left", clear: "both" }}
        />
      );
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

  if (message.mediaType === "call_log") {
    return (
      <React.Fragment>
        {renderDailyTimestamps(message, index)}
        {renderNumberTicket(message, index)}
        {renderMessageDivider(message, index)}
        <div className={classes.messageCenter}>
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
            <span className={sharedClasses.messageContactName}>
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
      <React.Fragment>
        {renderDailyTimestamps(message, index)}
        {renderNumberTicket(message, index)}
        {renderMessageDivider(message, index)}
        <MessageSelect selectedList={selectedForwardMessages} setSelectedList={setSelectedForwardMessages} isSelectionEnabled={isForwarding} message={message}>
          <div className={classes.messageLeft}>
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
              <span className={sharedClasses.messageContactName}>
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
            ) && <MessageMediaPreview message={message} />}
            <div className={classes.textContentItem}>
              {message.quotedMsg && <QuotedMessage message={message} />}
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
  }

  return (
    <React.Fragment>
      {renderDailyTimestamps(message, index)}
      {renderNumberTicket(message, index)}
      {renderMessageDivider(message, index)}
      <MessageSelect selectedList={selectedForwardMessages} setSelectedList={setSelectedForwardMessages} isSelectionEnabled={isForwarding} message={message}>
        <div className={classes.messageRight} style={message.isEdited ? { minWidth: '170px' } : {}}>
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
          ) && <MessageMediaPreview message={message} />}
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
            {message.quotedMsg && <QuotedMessage message={message} />}
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
};
