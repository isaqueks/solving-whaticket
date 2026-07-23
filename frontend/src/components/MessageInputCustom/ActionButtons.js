import React from "react";

import IconButton from "@material-ui/core/IconButton";
import MicIcon from "@material-ui/icons/Mic";
import SendIcon from "@material-ui/icons/Send";

import { RecordingView } from "./RecordingView";
import { useSharedInputStyles } from "./sharedStyles";

/**
 * Botão de ação à direita do input: enviar (com texto digitado), gravação em
 * andamento (RecordingView) ou microfone. Condições idênticas ao original.
 */
export const ActionButtons = (props) => {
  const {
    inputMessage,
    loading,
    recording,
    ticketStatus,
    handleSendMessage,
    handleCancelAudio,
    handleUploadAudio,
    handleStartRecording,
  } = props;

  const isOpen = () => !!ticketStatus;

  const sharedClasses = useSharedInputStyles();

  if (inputMessage) {
    return (
      <IconButton
        aria-label="sendMessage"
        component="span"
        onClick={handleSendMessage}
        disabled={loading}
      >
        <SendIcon className={sharedClasses.sendMessageIcons} />
      </IconButton>
    );
  }

  if (recording) {
    return (
      <RecordingView
        loading={loading}
        handleCancelAudio={handleCancelAudio}
        handleUploadAudio={handleUploadAudio}
      />
    );
  }

  return (
    <IconButton
      aria-label="showRecorder"
      component="span"
      disabled={loading || !isOpen()}
      onClick={handleStartRecording}
    >
      <MicIcon className={sharedClasses.sendMessageIcons} />
    </IconButton>
  );
};
