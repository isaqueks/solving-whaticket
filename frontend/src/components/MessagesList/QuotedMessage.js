import React from "react";

import clsx from "clsx";

import { Button, makeStyles } from "@material-ui/core";
import { GetApp } from "@material-ui/icons";

import ModalImageCors from "../ModalImageCors";
import { useSharedMessageStyles } from "./sharedStyles";

const useStyles = makeStyles(() => ({
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
}));

/**
 * Bloco de citação dentro da bolha (era o renderQuotedMessage do index.js).
 * A citação NÃO reusa o MessageMediaPreview de propósito: as regras aqui são
 * outras (áudio sempre ogg, sem branch de localização/vcard, fallback `||
 * body` na imagem) — unificar mudaria comportamento.
 */
export const QuotedMessage = ({ message }) => {
  const classes = useStyles();
  const sharedClasses = useSharedMessageStyles();

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
          <span className={sharedClasses.messageContactName}>
            {message.quotedMsg?.contact?.name}
          </span>
        )}

        {message.quotedMsg.mediaType === "audio"
          && (
            <div className={sharedClasses.downloadMedia}>
              <audio controls>
                <source src={message.quotedMsg.mediaUrl} type="audio/ogg"></source>
              </audio>
            </div>
          )
        }
        {message.quotedMsg.mediaType === "video"
          && (
            <video
              className={sharedClasses.messageMedia}
              src={message.quotedMsg.mediaUrl}
              controls
            />
          )
        }
        {message.quotedMsg.mediaType === "application"
          && (
            <div className={sharedClasses.downloadMedia}>
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
