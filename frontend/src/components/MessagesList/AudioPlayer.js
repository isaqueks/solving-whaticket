import React from "react";

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

/**
 * Player de áudio das mensagens. No iOS o ogg não toca — o mediaUrl é trocado
 * para mp3. A mutação de `message.mediaUrl` é proposital e preservada do
 * original: renders subsequentes (e o menu de opções) já veem a URL mp3.
 */
export const AudioPlayer = ({ message }) => {
  if (isIOS) {
    message.mediaUrl = message.mediaUrl.replace("ogg", "mp3");

    return (
      <audio controls>
        <source src={message.mediaUrl} type="audio/mp3"></source>
      </audio>
    );
  }

  return (
    <audio controls>
      <source src={message.mediaUrl} type="audio/ogg"></source>
    </audio>
  );
};
