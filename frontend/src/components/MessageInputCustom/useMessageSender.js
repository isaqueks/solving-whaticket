import { messagesApi } from "../../api/MessagesApi";

/**
 * Envio de mensagens do ticket — encapsula as 4 chamadas de API que estavam
 * inline no index.js (todas POST /messages/:ticketId, via MessagesApi).
 * A montagem do FormData de cada variante vive aqui; o estado (loading,
 * pendingMessages, limpeza do input) continua no componente.
 */
export const useMessageSender = (ticketId) => {
  /**
   * Monta o payload de texto + a mensagem otimista (pendingMsg) exibida até o
   * socket confirmar — literais idênticos aos do handleSendMessage original.
   */
  const buildTextMessage = ({
    inputMessage,
    signMessage,
    userName,
    replyingMessage,
    editingMessage,
  }) => {
    const tempId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    const message = {
      tempId,
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: signMessage
        ? `*${userName}:*\n${inputMessage.trim()}`
        : inputMessage.trim(),
      quotedMsg: replyingMessage,
      editMsg: editingMessage
    };

    const pendingMsg = {
      "mediaUrl": null,
      "id": tempId,
      "participant": "",
      "ack": 0,
      "read": false,
      "fromMe": true,
      "body": message.body,
      "mediaType": "extendedTextMessage",
      "isDeleted": false,
      "createdAt": new Date().toISOString(),
      "updatedAt": new Date().toISOString(),
      "quotedMsgId": message.quotedMsg?.id || null,
      "ticketId": ticketId,
      "isEdited": false,
      "quotedMsg": message.quotedMsg,
    }

    return { tempId, message, pendingMsg };
  };

  const sendTextMessage = (message) => {
    return messagesApi.send(ticketId, message);
  };

  const sendMediaMessage = (medias) => {
    const formData = new FormData();
    formData.append("fromMe", true);
    medias.forEach((media) => {
      formData.append("medias", media);
      formData.append("body", media.name);
    });

    return messagesApi.send(ticketId, formData);
  };

  const sendAudioMessage = (blob) => {
    const formData = new FormData();
    const filename = `audio-record-site-${new Date().getTime()}.mp3`;
    formData.append("medias", blob, filename);
    formData.append("body", filename);
    formData.append("fromMe", true);

    return messagesApi.send(ticketId, formData);
  };

  const sendQuickMessageMedia = (blob, message) => {
    const extension = blob.type.split("/")[1];

    const formData = new FormData();
    const filename = `${new Date().getTime()}.${extension}`;
    formData.append("medias", blob, filename);
    formData.append("body", message);
    formData.append("fromMe", true);

    return messagesApi.send(ticketId, formData);
  };

  return {
    buildTextMessage,
    sendTextMessage,
    sendMediaMessage,
    sendAudioMessage,
    sendQuickMessageMedia,
  };
};
