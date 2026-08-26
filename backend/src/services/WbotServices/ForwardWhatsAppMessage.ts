import { AnyMessageContent, WAMessage } from "baileys";
import fs from "fs";
import mime from "mime-types";
import path from "path";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getContactJid } from "../../helpers/getContactJid";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";

interface Request {
  contactId: number;
  whatsappId?: number;
  messagesId: string[];
  companyId: number;
}

export interface ForwardResult {
  sent: string[];
  failed: { id: string; reason: string }[];
  skipped: { id: string; reason: string }[];
}

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

// mediaType gravado por verifyMessage (nome do content type do Baileys) para
// mensagens que são apenas texto.
const TEXT_MEDIA_TYPES = [
  "conversation",
  "extendedTextMessage",
  "editedMessage"
];

const DEFAULT_MIMETYPE = "application/octet-stream";

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

interface OriginalMedia {
  mimetype?: string;
  fileName?: string;
  caption?: string;
  ptt?: boolean;
  seconds?: number;
  isSticker?: boolean;
}

/**
 * Conteúdo original da mensagem, como veio do WhatsApp. É a única fonte
 * confiável de mimetype/nome de arquivo: a coluna `mediaUrl` guarda apenas o
 * nome local do arquivo e `mediaType` guarda somente o prefixo do mimetype
 * ("application", "text", "image"...).
 */
const getRawMessage = (message: Message): WAMessage | null => {
  if (!message.dataJson) {
    return null;
  }
  try {
    return JSON.parse(message.dataJson) as WAMessage;
  } catch (err) {
    logger.warn(
      `[forward] dataJson inválido na mensagem ${message.id}: ${err}`
    );
    return null;
  }
};

const getOriginalMedia = (raw: WAMessage | null): OriginalMedia | null => {
  const content: any = raw?.message;
  if (!content) {
    return null;
  }

  const document =
    content.documentMessage ||
    content.documentWithCaptionMessage?.message?.documentMessage;

  if (document) {
    return {
      mimetype: document.mimetype,
      fileName: document.fileName,
      caption: document.caption
    };
  }

  if (content.imageMessage) {
    return {
      mimetype: content.imageMessage.mimetype,
      caption: content.imageMessage.caption
    };
  }

  if (content.videoMessage) {
    return {
      mimetype: content.videoMessage.mimetype,
      caption: content.videoMessage.caption,
      seconds: content.videoMessage.seconds
    };
  }

  if (content.audioMessage) {
    return {
      mimetype: content.audioMessage.mimetype,
      ptt: !!content.audioMessage.ptt,
      seconds: content.audioMessage.seconds
    };
  }

  if (content.stickerMessage) {
    return {
      mimetype: content.stickerMessage.mimetype,
      isSticker: true
    };
  }

  return null;
};

/**
 * Caminho local do arquivo da mensagem, sempre dentro de `publicFolder`.
 * Usa o valor cru da coluna (o getter do model devolve a URL pública) e barra
 * qualquer tentativa de escapar do diretório.
 */
const resolveLocalMedia = (message: Message): string | null => {
  const stored = message.getDataValue("mediaUrl") as unknown as string;
  if (!stored) {
    return null;
  }

  const normalized = String(stored).replace(/^\/+/, "");

  // Mensagens gravam o nome do arquivo direto na raiz de public/, mas toleramos
  // um caminho relativo caso o registro seja antigo.
  const candidates = [
    path.resolve(publicFolder, normalized),
    path.resolve(publicFolder, path.basename(normalized))
  ];

  for (const candidate of candidates) {
    if (
      candidate !== publicFolder &&
      !candidate.startsWith(`${publicFolder}${path.sep}`)
    ) {
      continue;
    }
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
};

/**
 * Nome exibido ao destinatário. Prioriza o nome original do documento; senão
 * remove o prefixo de timestamp que o download acrescenta.
 */
const getDocumentFileName = (
  message: Message,
  original: OriginalMedia | null,
  filePath: string
): string => {
  if (original?.fileName) {
    return path.basename(original.fileName);
  }
  return path.basename(filePath).replace(/^\d{10,}_/, "");
};

/**
 * `verifyMediaMessage` grava o nome do arquivo em `body` quando a mídia não tem
 * legenda. Nesse caso não há legenda de verdade para encaminhar.
 */
const getCaption = (
  message: Message,
  original: OriginalMedia | null
): string | undefined => {
  if (original?.caption) {
    return original.caption;
  }

  const stored = message.getDataValue("mediaUrl") as unknown as string;
  const body = message.body;

  if (!body || body === stored) {
    return undefined;
  }

  return body;
};

const buildMediaContent = async (
  message: Message,
  filePath: string,
  original: OriginalMedia | null
): Promise<AnyMessageContent> => {
  const media = await fs.promises.readFile(filePath);

  const mimetype =
    original?.mimetype || mime.lookup(filePath) || DEFAULT_MIMETYPE;
  const kind = mimetype.split("/")[0];
  const caption = getCaption(message, original);

  if (original?.isSticker || mimetype === "image/webp") {
    return { sticker: media };
  }

  if (kind === "image") {
    return { image: media, mimetype, caption };
  }

  if (kind === "video") {
    return { video: media, mimetype, caption, seconds: original?.seconds };
  }

  if (kind === "audio") {
    // Mantém o formato original: reencaminhar um mp3 como ogg/opus quebra a
    // reprodução no destino.
    return {
      audio: media,
      mimetype,
      ptt: original?.ptt ?? false,
      seconds: original?.seconds
    };
  }

  return {
    document: media,
    mimetype,
    fileName: getDocumentFileName(message, original, filePath),
    caption
  };
};

const getForwardableText = (message: Message): string | null => {
  if (TEXT_MEDIA_TYPES.includes(message.mediaType) && message.body) {
    return message.body;
  }

  // locationMessage guarda "thumbnail|link|descrição"
  if (message.mediaType === "locationMessage" && message.body) {
    const parts = message.body.split("|");
    if (parts.length >= 2 && parts[1]) {
      return parts.slice(1).filter(Boolean).join(" - ");
    }
  }

  return null;
};

const resolveWbot = async (
  companyId: number,
  whatsappId?: number
): Promise<ReturnType<typeof getWbot>> => {
  if (whatsappId) {
    const whatsapp = await Whatsapp.findOne({
      where: { id: whatsappId, companyId },
      attributes: ["id"]
    });

    if (whatsapp) {
      try {
        return getWbot(whatsapp.id);
      } catch (err) {
        logger.warn(
          `[forward] conexão ${whatsapp.id} não inicializada, usando a padrão`
        );
      }
    }
  }

  const fallback = await GetDefaultWhatsApp(companyId);
  return getWbot(fallback.id);
};

const ForwardWhatsAppMessage = async ({
  contactId,
  whatsappId,
  messagesId,
  companyId
}: Request): Promise<ForwardResult> => {
  if (!Array.isArray(messagesId) || messagesId.length === 0) {
    throw new AppError("Nenhuma mensagem selecionada para encaminhar");
  }

  const contact = await Contact.findOne({
    where: { id: contactId, companyId }
  });

  if (!contact) {
    throw new AppError("Contact not found", 404);
  }

  const wbot = await resolveWbot(companyId, whatsappId);

  const messages = await Message.findAll({
    where: {
      id: { [Op.in]: messagesId },
      companyId
    },
    order: [["createdAt", "ASC"]]
  });

  if (messages.length === 0) {
    throw new AppError("Mensagens não encontradas", 404);
  }

  const jid = getContactJid(contact);
  const result: ForwardResult = { sent: [], failed: [], skipped: [] };

  for (const message of messages) {
    try {
      const raw = getRawMessage(message);
      const hasMedia = !!message.getDataValue("mediaUrl");
      const filePath = hasMedia ? resolveLocalMedia(message) : null;

      if (filePath) {
        const content = await buildMediaContent(
          message,
          filePath,
          getOriginalMedia(raw)
        );
        await wbot.sendMessage(jid, content);
        result.sent.push(message.id);
        await sleep(1500);
        continue;
      }

      const text = getForwardableText(message);
      if (text) {
        await wbot.sendMessage(jid, { text });
        result.sent.push(message.id);
        continue;
      }

      // Sem arquivo local (download original falhou ou o arquivo foi removido)
      // e sem texto: tenta o encaminhamento nativo, que reusa a mídia que ainda
      // está nos servidores do WhatsApp.
      if (raw?.message) {
        if (hasMedia) {
          logger.warn(
            `[forward] arquivo local ausente para a mensagem ${message.id}, usando encaminhamento nativo`
          );
        }
        await wbot.sendMessage(jid, { forward: raw });
        result.sent.push(message.id);
        await sleep(1500);
        continue;
      }

      result.skipped.push({
        id: message.id,
        reason: `Tipo de mensagem não suportado para encaminhamento (${message.mediaType})`
      });
    } catch (err) {
      logger.error(
        `[forward] falha ao encaminhar a mensagem ${message.id}: ${err?.message ||
          err}`
      );
      result.failed.push({
        id: message.id,
        reason: err?.message || "Erro desconhecido"
      });
    }
  }

  const notFound = messagesId.filter(
    id => !messages.some(message => message.id === id)
  );
  notFound.forEach(id =>
    result.skipped.push({ id, reason: "Mensagem não encontrada" })
  );

  if (result.sent.length === 0) {
    const reason =
      result.failed[0]?.reason ||
      result.skipped[0]?.reason ||
      "Não foi possível encaminhar as mensagens";
    throw new AppError(reason, 400);
  }

  return result;
};

export default ForwardWhatsAppMessage;
