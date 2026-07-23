import React from "react";

import { Button, Divider } from "@material-ui/core";
import { GetApp } from "@material-ui/icons";

import LocationPreview from "../LocationPreview";
import ModalImageCors from "../ModalImageCors";
import VCardPreview from "../VCardPreview";
import { AudioPlayer } from "./AudioPlayer";
import { useSharedMessageStyles } from "./sharedStyles";

/**
 * Preview de mídia de uma mensagem (era o checkMessageMedia do index.js):
 * localização, vcard/contato, imagem, áudio, vídeo e o fallback de download.
 * Lógica idêntica ao original, reescrita com guard clauses (doc 04 §5).
 */
export const MessageMediaPreview = ({ message }) => {
  const sharedClasses = useSharedMessageStyles();

  if (message.mediaType === "locationMessage" && message.body.split('|').length >= 2) {
    let locationParts = message.body.split('|')
    let imageLocation = locationParts[0]
    let linkLocation = locationParts[1]

    let descriptionLocation = null

    if (locationParts.length > 2)
      descriptionLocation = message.body.split('|')[2]

    return <LocationPreview image={imageLocation} link={linkLocation} description={descriptionLocation} />
  }

  if (message.mediaType === "contactMessage") {
    let array = message.body.split("\n");
    let obj = [];
    let contact = "";
    for (let index = 0; index < array.length; index++) {
      const v = array[index];
      let values = v.split(":");
      for (let ind = 0; ind < values.length; ind++) {
        if (values[ind].indexOf("+") !== -1) {
          obj.push({ number: values[ind] });
        }
        if (values[ind].indexOf("FN") !== -1) {
          contact = values[ind + 1];
        }
      }
    }
    return <VCardPreview contact={contact} numbers={obj.length > 0 ? obj[0].number : ""} />
  }

  if (message.mediaType === "image") {
    return <ModalImageCors imageUrl={message.mediaUrl} />;
  }

  if (message.mediaType === "audio") {
    return <AudioPlayer message={message} />;
  }

  if (message.mediaType === "video") {
    return (
      <video
        className={sharedClasses.messageMedia}
        src={message.mediaUrl}
        controls
      />
    );
  }

  return (
    <>
      <div className={sharedClasses.downloadMedia}>
        <Button
          startIcon={<GetApp />}
          color="primary"
          variant="outlined"
          target="_blank"
          href={message.mediaUrl}
        >
          Download
        </Button>
      </div>
      <Divider />
    </>
  );
};
