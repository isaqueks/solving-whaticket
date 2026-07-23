import React from "react";
import clsx from "clsx";

import { makeStyles } from "@material-ui/core/styles";
import IconButton from "@material-ui/core/IconButton";
import ClearIcon from "@material-ui/icons/Clear";

import { useSharedInputStyles } from "./sharedStyles";

const useStyles = makeStyles(() => ({
  replyginMsgWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingLeft: 73,
    paddingRight: 7,
  },

  replyginMsgContainer: {
    flex: 1,
    marginRight: 5,
    overflowY: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  replyginMsgBody: {
    padding: 10,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  replyginContactMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },

  replyginSelfMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#6bcbef",
  },

  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },
}));

/**
 * Barra acima do input com a mensagem sendo RESPONDIDA ou EDITADA. Os dois
 * renders originais (renderReplyingMessage/renderEditingMessage) eram
 * idênticos exceto o alvo do X — a diferença virou o prop `onClose` (§10).
 */
export const ReplyingMessageBar = ({ message, disabled, onClose }) => {
  const classes = useStyles();
  const sharedClasses = useSharedInputStyles();

  return (
    <div className={classes.replyginMsgWrapper}>
      <div className={classes.replyginMsgContainer}>
        <span
          className={clsx(classes.replyginContactMsgSideColor, {
            [classes.replyginSelfMsgSideColor]: !message.fromMe,
          })}
        ></span>
        <div className={classes.replyginMsgBody}>
          {!message.fromMe && (
            <span className={classes.messageContactName}>
              {message.contact?.name}
            </span>
          )}
          {message.body}
        </div>
      </div>
      <IconButton
        aria-label="showRecorder"
        component="span"
        disabled={disabled}
        onClick={onClose}
      >
        <ClearIcon className={sharedClasses.sendMessageIcons} />
      </IconButton>
    </div>
  );
};
