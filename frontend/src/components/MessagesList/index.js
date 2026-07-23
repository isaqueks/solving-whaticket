import React, { useContext, useEffect, useState } from "react";

import { CircularProgress, makeStyles } from "@material-ui/core";
import { green } from "@material-ui/core/colors";

import whatsBackground from "../../assets/wpp-bg.png"//"../../assets/wa-background.png";
import whatsBackgroundDark from "../../assets/wa-background-dark.png"; //DARK MODE PLW DESIGN//
import MessageOptionsMenu from "../MessageOptionsMenu";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { MessageBubble } from "./MessageBubble";
import { useMessagesList } from "./useMessagesList";
import { useMessagesSocket } from "./useMessagesSocket";

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
}));

const MessagesList = ({
  ticket,
  ticketId,
  isGroup,
  pendingMessages = [],
  setPendingMessages = () => 0,
}) => {
  const classes = useStyles();

  const [selectedMessage, setSelectedMessage] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);

  const {
    isForwarding,
    setIsForwarding,
    selectedForwardMessages,
    setSelectedForwardMessages
  } = useContext(ReplyMessageContext);

  const {
    messagesList,
    dispatch,
    loading,
    handleScroll,
    lastMessageRef,
    scrollToBottom,
    currentTicketId,
    overwrittenMessages,
  } = useMessagesList(ticketId, { pendingMessages, setPendingMessages });

  useMessagesSocket({ ticket, ticketId, currentTicketId, dispatch, scrollToBottom });

  useEffect(() => {
    setSelectedForwardMessages([]);
    setIsForwarding(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const handleOpenMessageOptionsMenu = (e, message) => {
    setAnchorEl(e.currentTarget);
    setSelectedMessage(message);
  };

  const handleCloseMessageOptionsMenu = (e) => {
    setAnchorEl(null);
  };

  const renderMessages = () => {
    if (messagesList.length === 0) {
      return <div>Diga olá para seu novo contato!</div>;
    }

    return [...messagesList, ...pendingMessages].map((message, index) => {
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

      return (
        <MessageBubble
          key={message.id}
          message={message}
          index={index}
          messagesList={messagesList}
          isGroup={isGroup}
          lastMessageRef={lastMessageRef}
          isForwarding={isForwarding}
          selectedForwardMessages={selectedForwardMessages}
          setSelectedForwardMessages={setSelectedForwardMessages}
          handleOpenMessageOptionsMenu={handleOpenMessageOptionsMenu}
        />
      );
    });
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
        className={classes.messagesList}
        onScroll={handleScroll}
      >
        {messagesList.length > 0 ? renderMessages() : []}
      </div>
      {loading && (
        <div>
          <CircularProgress className={classes.circleLoading} />
        </div>
      )}
    </div>
  );
};

export default MessagesList;
