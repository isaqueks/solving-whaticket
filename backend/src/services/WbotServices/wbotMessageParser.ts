import {
  extractMessageContent,
  getContentType,
  proto,
  WAMessage,
  WAMessageStubType
} from "baileys";

import { logger } from "../../utils/logger";

const multVecardGet = function (param: any) {
  let output = " "

  let name = param.split("\n")[2].replace(";;;", "\n").replace('N:', "").replace(";", "").replace(";", " ").replace(";;", " ").replace("\n", "")
  let inicio = param.split("\n")[4].indexOf('=')
  let fim = param.split("\n")[4].indexOf(':')
  let contact = param.split("\n")[4].substring(inicio + 1, fim).replace(";", "")
  let contactSemWhats = param.split("\n")[4].replace("item1.TEL:", "")

  if (contact != "item1.TEL") {
    output = output + name + ": 📞" + contact + "" + "\n"
  } else
    output = output + name + ": 📞" + contactSemWhats + "" + "\n"
  return output
}

const contactsArrayMessageGet = (msg: any,) => {
  let contactsArray = msg.message?.contactsArrayMessage?.contacts
  let vcardMulti = contactsArray.map(function (item, indice) {
    return item.vcard;
  });

  let bodymessage = ``
  vcardMulti.forEach(function (vcard, indice) {
    bodymessage += vcard + "\n\n" + ""
  })

  let contacts = bodymessage.split("BEGIN:")

  contacts.shift()
  let finalContacts = ""
  for (let contact of contacts) {
    finalContacts = finalContacts + multVecardGet(contact)
  }

  return finalContacts
}

export const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  if (msg.message?.protocolMessage?.editedMessage) {
    return 'editedMessage';
  }
  return getContentType(msg.message);
};


const getBodyButton = (msg: proto.IWebMessageInfo): string => {
  if (msg.key.fromMe && msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText) {
    let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText}*`;

    for (const buton of msg.message?.viewOnceMessage?.message?.buttonsMessage?.buttons) {
      bodyMessage += `\n\n${buton.buttonText?.displayText}`;
    }
    return bodyMessage;
  }

  if (msg.key.fromMe && msg?.message?.viewOnceMessage?.message?.listMessage) {
    let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.listMessage?.description}*`;
    for (const buton of msg.message?.viewOnceMessage?.message?.listMessage?.sections) {
      for (const rows of buton.rows) {
        bodyMessage += `\n\n${rows.title}`;
      }
    }

    return bodyMessage;
  }
};

const msgLocation = (image, latitude, longitude) => {
  if (!image) return;

  var b64 = Buffer.from(image).toString("base64");

  let data = `data:image/png;base64, ${b64} | https://maps.google.com/maps?q=${latitude}%2C${longitude}&z=17&hl=pt-BR|${latitude}, ${longitude} `;
  return data;
};

export const getBodyMessage = (msg: proto.IWebMessageInfo): string | null => {

  try {
    let type = getTypeMessage(msg);

    const types = {
      conversation: msg?.message?.conversation,
      editedMessage:
        msg?.message?.protocolMessage?.editedMessage?.conversation ||
        msg?.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text ||
        msg?.message.editedMessage?.['protocolMessage']?.editedMessage?.conversation ||
        msg?.message.editedMessage?.['protocolMessage']?.editedMessage?.extendedTextMessage?.text,
      imageMessage: msg.message?.imageMessage?.caption,
      videoMessage: msg.message?.videoMessage?.caption,
      extendedTextMessage: msg.message?.extendedTextMessage?.text,
      buttonsResponseMessage: msg.message?.buttonsResponseMessage?.selectedButtonId,
      templateButtonReplyMessage: msg.message?.templateButtonReplyMessage?.selectedId,
      messageContextInfo: msg.message?.buttonsResponseMessage?.selectedButtonId || msg.message?.listResponseMessage?.title,
      buttonsMessage: getBodyButton(msg) || msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      viewOnceMessage: getBodyButton(msg) || msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      stickerMessage: "sticker",
      contactMessage: msg.message?.contactMessage?.vcard,
      contactsArrayMessage: (msg.message?.contactsArrayMessage?.contacts) && contactsArrayMessageGet(msg),
      //locationMessage: `Latitude: ${msg.message.locationMessage?.degreesLatitude} - Longitude: ${msg.message.locationMessage?.degreesLongitude}`,
      locationMessage: msgLocation(
        msg.message?.locationMessage?.jpegThumbnail,
        msg.message?.locationMessage?.degreesLatitude,
        msg.message?.locationMessage?.degreesLongitude
      ),
      liveLocationMessage: `Latitude: ${msg.message?.liveLocationMessage?.degreesLatitude} - Longitude: ${msg.message?.liveLocationMessage?.degreesLongitude}`,
      documentMessage: msg.message?.documentMessage?.title,
      documentWithCaptionMessage: msg.message?.documentWithCaptionMessage?.message?.documentMessage?.caption,
      audioMessage: "Áudio",
      listMessage: getBodyButton(msg) || msg.message?.listResponseMessage?.title,
      listResponseMessage: msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      reactionMessage: msg.message?.reactionMessage?.text || "reaction",
    };

    const objKey = Object.keys(types).find(key => key === type);

    if (!objKey) {
      logger.warn(`#### Nao achou o type 152: ${type}
${JSON.stringify(msg)}`);
    }
    return types[type];
  } catch (error) {
    logger.error(error);
    return null;
  }
};


export const getQuotedMessageId = (msg: proto.IWebMessageInfo) => {
  const body = extractMessageContent(msg.message)[
    Object.keys(msg?.message).values().next().value
  ];

  return body?.contextInfo?.stanzaId;
};

export const isValidMsg = (msg: proto.IWebMessageInfo): boolean => {
  if (msg.key.remoteJid === "status@broadcast") return false;
  try {
    const msgType = getTypeMessage(msg);
    if (!msgType) {
      return false;
    }

    const ifType =
      msgType === "conversation" ||
      msgType === "extendedTextMessage" ||
      msgType === "editedMessage" ||
      msgType === "audioMessage" ||
      msgType === "videoMessage" ||
      msgType === "imageMessage" ||
      msgType === "documentMessage" ||
      msgType === "documentWithCaptionMessage" ||
      msgType === "stickerMessage" ||
      msgType === "buttonsResponseMessage" ||
      msgType === "buttonsMessage" ||
      msgType === "messageContextInfo" ||
      msgType === "locationMessage" ||
      msgType === "liveLocationMessage" ||
      msgType === "contactMessage" ||
      msgType === "voiceMessage" ||
      msgType === "mediaMessage" ||
      msgType === "contactsArrayMessage" ||
      msgType === "reactionMessage" ||
      msgType === "ephemeralMessage" ||
      msgType === "protocolMessage" ||
      msgType === "listResponseMessage" ||
      msgType === "listMessage" ||
      msgType === "viewOnceMessage";

    if (!ifType) {
      logger.warn(`#### Nao achou o type em isValidMsg: ${msgType}
${JSON.stringify(msg?.message)}`);
    }

    return !!ifType;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

export const filterMessages = (msg: WAMessage): boolean => {
  if (msg.message?.protocolMessage && !msg.message?.protocolMessage.editedMessage)
    return false;

  if (
    [
      WAMessageStubType.REVOKE,
      WAMessageStubType.E2E_DEVICE_CHANGED,
      WAMessageStubType.E2E_IDENTITY_CHANGED,
      WAMessageStubType.CIPHERTEXT
    ].includes(msg.messageStubType as proto.WebMessageInfo.StubType)
  )
    return false;

  return true;
};
