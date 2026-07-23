import React, { useState, useEffect, useContext, useRef } from "react";
import withWidth from "@material-ui/core/withWidth";
import axios from "axios";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";

import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import useAudioRecorder from "../../hooks/useAudioRecorder";
import toastError from "../../errors/toastError";

import { ActionButtons } from "./ActionButtons";
import { AttachmentInput } from "./AttachmentInput";
import { CustomInput } from "./CustomInput";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import { ForwardingView } from "./ForwardingView";
import { MediaUploadView } from "./MediaUploadView";
import { ReplyingMessageBar } from "./ReplyingMessageBar";
import { SignSwitch } from "./SignSwitch";
import { useMessageSender } from "./useMessageSender";

const useStyles = makeStyles((theme) => ({
  mainWrapper: {
    backgroundColor: theme.palette.bordabox, //DARK MODE PLW DESIGN//
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
  },

  newMessageBox: {
    backgroundColor: theme.palette.newmessagebox, //DARK MODE PLW DESIGN//
    width: "100%",
    display: "flex",
    padding: "7px",
    alignItems: "center",
  },
}));

const MessageInputCustom = (props) => {
  const { ticketStatus, ticketId, ticket, pendingMessages, setPendingMessages } = props;
  const classes = useStyles();

  const [medias, setMedias] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const inputRef = useRef();
  const {
    setReplyingMessage,
    replyingMessage,
    editingMessage,
    setEditingMessage,
    isForwarding,
    setIsForwarding,
    setSelectedForwardMessages,
    selectedForwardMessages
  } =
    useContext(ReplyMessageContext);
  const { user } = useContext(AuthContext);

  const [signMessage, setSignMessage] = useLocalStorage("signOption", true);

  const { recording, startRecording, stopRecording, cancelRecording } =
    useAudioRecorder();
  const {
    buildTextMessage,
    sendTextMessage,
    sendMediaMessage,
    sendAudioMessage,
    sendQuickMessageMedia,
  } = useMessageSender(ticketId);

  const isOpen = () => !!ticketStatus/* === "open"*/;

  useEffect(() => {
    inputRef.current.focus();
  }, [replyingMessage, editingMessage]);

  useEffect(() => {
    if (editingMessage) {
      setInputMessage(signMessage ? editingMessage.body.replace(`*${user?.name}:*\n`, '') : editingMessage.body);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMessage]);

  useEffect(() => {
    inputRef.current.focus();
    return () => {
      setInputMessage("");
      setShowEmoji(false);
      setMedias([]);
      setReplyingMessage(null);
      setEditingMessage(null);
      setIsForwarding(false);
      setSelectedForwardMessages([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, setReplyingMessage]);

  const handleAddEmoji = (e) => {
    let emoji = e.native;
    setInputMessage((prevState) => prevState + emoji);
  };

  const handleChangeMedias = (e) => {
    if (!e.target.files) {
      return;
    }

    const selectedMedias = Array.from(e.target.files);
    setMedias(selectedMedias);
  };

  const handleInputPaste = (e) => {
    if (e.clipboardData.files[0]) {
      setMedias([e.clipboardData.files[0]]);
    }
  };

  const handleUploadQuickMessageMedia = async (blob, message) => {
    setLoading(true);
    try {
      await sendQuickMessageMedia(blob, message);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
    setLoading(false);
  };

  const handleQuickAnswersClick = async (value) => {
    if (value.mediaPath) {
      try {
        // download da mídia do atalho: URL absoluta externa, fora do axios da
        // API (não vira método de MessagesApi de propósito)
        const { data } = await axios.get(value.mediaPath, {
          responseType: "blob",
        });

        handleUploadQuickMessageMedia(data, value.value);
        setInputMessage("");
        return;
      } catch (err) {
        toastError(err);
      }
    }

    setInputMessage("");
    setInputMessage(value.value);
  };

  const handleUploadMedia = async (e) => {
    setLoading(true);
    e.preventDefault();

    try {
      await sendMediaMessage(medias);
    } catch (err) {
      toastError(err);
    }

    setLoading(false);
    setMedias([]);
  };

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "") return;

    const { tempId, message, pendingMsg } = buildTextMessage({
      inputMessage,
      signMessage,
      userName: user?.name,
      replyingMessage,
      editingMessage,
    });

    if (!editingMessage) {
      setPendingMessages(prev => [...prev, pendingMsg]);
    }
    setTimeout(() => setInputMessage(""), 1);

    try {
      await sendTextMessage(message);
    } catch (err) {
      setPendingMessages(prev => prev.filter(m => m.id !== tempId));
      toastError(err);
    }

    setShowEmoji(false);
    setEditingMessage(null);
    setReplyingMessage(null);
  };

  const handleStartRecording = async () => {
    setLoading(true);
    try {
      await startRecording();
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleUploadAudio = async () => {
    setLoading(true);
    try {
      const blob = await stopRecording();
      if (blob.size < 10000) {
        setLoading(false);
        return;
      }

      await sendAudioMessage(blob);
    } catch (err) {
      toastError(err);
    }

    setLoading(false);
  };

  const handleCancelAudio = async () => {
    try {
      await cancelRecording();
    } catch (err) {
      toastError(err);
    }
  };

  const disableOption = () => {
    if (loading) {
      return 'Carregando';
    }
    if (recording) {
      return 'Gravando';
    }
    if (!isOpen()) {
      return 'Ticket Fechado';
    }
  };

  if (isForwarding) {
    return (
      <ForwardingView
        isForwarding={isForwarding}
        setIsForwarding={setIsForwarding}
        forwardModalOpen={forwardModalOpen}
        setForwardModalOpen={setForwardModalOpen}
        selectedForwardMessages={selectedForwardMessages}
        loading={loading}
      />
    );
  }

  if (medias.length > 0) {
    return (
      <MediaUploadView
        medias={medias}
        setMedias={setMedias}
        loading={loading}
        handleUploadMedia={handleUploadMedia}
      />
    );
  }

  return (
    <Paper square elevation={0} className={classes.mainWrapper}>
      {replyingMessage && (
        <ReplyingMessageBar
          message={replyingMessage}
          disabled={loading || !isOpen()}
          onClose={() => setReplyingMessage(null)}
        />
      )}
      {editingMessage && (
        <ReplyingMessageBar
          message={editingMessage}
          disabled={loading || !isOpen()}
          onClose={() => setEditingMessage(null)}
        />
      )}
      <div className={classes.newMessageBox}>
        <EmojiPickerPopover
          disabled={disableOption()}
          handleAddEmoji={handleAddEmoji}
          showEmoji={showEmoji}
          setShowEmoji={setShowEmoji}
        />

        <AttachmentInput
          disableOption={disableOption}
          handleChangeMedias={handleChangeMedias}
        />

        <SignSwitch
          width={props.width}
          setSignMessage={setSignMessage}
          signMessage={signMessage}
        />

        <CustomInput
          loading={loading}
          inputRef={inputRef}
          ticketStatus={ticketStatus}
          inputMessage={inputMessage}
          setInputMessage={setInputMessage}
          handleSendMessage={handleSendMessage}
          handleInputPaste={handleInputPaste}
          disableOption={disableOption}
          handleQuickAnswersClick={handleQuickAnswersClick}
          isEditingMessage={!!editingMessage}
        />

        <ActionButtons
          inputMessage={inputMessage}
          loading={loading}
          recording={recording}
          ticketStatus={ticketStatus}
          handleSendMessage={handleSendMessage}
          handleCancelAudio={handleCancelAudio}
          handleUploadAudio={handleUploadAudio}
          handleStartRecording={handleStartRecording}
        />
      </div>
    </Paper>
  );
};

export default withWidth()(MessageInputCustom);
