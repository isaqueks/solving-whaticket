import React from "react";

import Paper from "@material-ui/core/Paper";
import IconButton from "@material-ui/core/IconButton";
import CancelIcon from "@material-ui/icons/Cancel";
import ForwardIcon from "@material-ui/icons/Forward";

import ForwardModal from "../ForwardModal";
import { useSharedInputStyles } from "./sharedStyles";

/**
 * Barra do modo "encaminhar mensagens" (substitui o input inteiro enquanto
 * isForwarding) + ForwardModal. JSX movido tal-qual do branch isForwarding do
 * index.js.
 */
export const ForwardingView = (props) => {
  const {
    isForwarding,
    setIsForwarding,
    forwardModalOpen,
    setForwardModalOpen,
    selectedForwardMessages,
    loading,
  } = props;

  const sharedClasses = useSharedInputStyles();

  const openForwardModal = async () => {
    setForwardModalOpen(true);
  }

  return (
    <>
      <ForwardModal
        modalOpen={forwardModalOpen && isForwarding}
        onClose={(e) => {
          setIsForwarding(false);
          setForwardModalOpen(false);
        }}
        messages={selectedForwardMessages}
      />
      <Paper elevation={0} square className={sharedClasses.viewMediaInputWrapper}>
        <IconButton
          aria-label="cancel-upload"
          component="span"
          onClick={(e) => setIsForwarding(false)}
        >
          <CancelIcon className={sharedClasses.sendMessageIcons} />
        </IconButton>


        <span>
          Encaminhe até 6 mensagens
        </span>

        <IconButton
          aria-label="send-upload"
          component="span"
          onClick={openForwardModal}
          disabled={loading}
        >
          <ForwardIcon className={sharedClasses.sendMessageIcons} />
        </IconButton>
      </Paper>
    </>
  );
};
