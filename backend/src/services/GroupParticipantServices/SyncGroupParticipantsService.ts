import { GroupMetadata } from "baileys";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import GroupParticipant from "../../models/GroupParticipant";
import { cacheLayer } from "../../libs/cache";
import { getContactJid } from "../../helpers/getContactJid";
import { logger } from "../../utils/logger";

type Session = {
  id?: number;
  groupMetadata: (jid: string) => Promise<GroupMetadata>;
};

interface Request {
  contactId: number;
  wbot: Session;
  forceSync?: boolean;
}

const CACHE_TTL = 30 * 60; // 30 minutos em segundos
const CACHE_KEY_PREFIX = "group-participants-sync";

const SyncGroupParticipantsService = async ({
  contactId,
  wbot,
  forceSync = false
}: Request): Promise<GroupParticipant[]> => {
  const contact = await Contact.findByPk(contactId);

  if (!contact) {
    throw new AppError("Contato não encontrado", 404);
  }

  if (!contact.isGroup) {
    throw new AppError("O contato não é um grupo", 400);
  }

  const cacheKey = `${CACHE_KEY_PREFIX}:${contactId}`;
  
  // Verifica cache se não for sync forçado
  if (!forceSync) {
    const cachedSync = await cacheLayer.get(cacheKey);
    if (cachedSync) {
      logger.debug(`Cache hit para participantes do grupo ${contactId}`);
      // Retorna participantes do banco mesmo com cache válido
      return await GroupParticipant.findAll({
        where: { groupContactId: contactId },
        order: [["isSuperAdmin", "DESC"], ["isAdmin", "DESC"], ["participantName", "ASC"]]
      });
    }
  }

  // Busca metadata do grupo via Baileys
  const groupJid = getContactJid(contact);
  
  let groupMetadata: GroupMetadata;
  try {
    groupMetadata = await wbot.groupMetadata(groupJid);
  } catch (error) {
    logger.error(`Erro ao buscar metadata do grupo ${groupJid}:`, error);
    throw new AppError("Erro ao buscar informações do grupo", 500);
  }

  // Processa participantes
  const participants = groupMetadata.participants || [];
  
  // Remove participantes antigos que não estão mais no grupo
  const currentParticipantNumbers = participants.map(p => {
    const jid = typeof p === "string" ? p : p.id;
    return jid.replace(/@.*$/, "");
  });

  await GroupParticipant.destroy({
    where: {
      groupContactId: contactId,
      participantNumber: { [Op.notIn]: currentParticipantNumbers }
    }
  });

  // Cria ou atualiza participantes
  const participantPromises = participants.map(async (participant) => {
    const jid = typeof participant === "string" ? participant : participant.id;
    const participantNumber = jid.replace(/@.*$/, "");
    
    // Verifica se é admin
    const isAdmin = typeof participant === "object" 
      ? (participant.admin === "admin" || participant.admin === "superadmin")
      : false;
    
    const isSuperAdmin = typeof participant === "object"
      ? participant.admin === "superadmin"
      : false;

    // Busca nome do participante (pode estar no metadata)
    let participantName = "";
    if (typeof participant === "object" && participant.notify) {
      participantName = participant.notify;
    }

    // Busca ou cria participante
    const [groupParticipant, created] = await GroupParticipant.findOrCreate({
      where: {
        groupContactId: contactId,
        participantNumber
      },
      defaults: {
        participantName: participantName || participantNumber,
        isAdmin,
        isSuperAdmin,
        companyId: contact.companyId,
        profilePicUrl: ""
      }
    });

    // Atualiza se já existia
    if (!created) {
      await groupParticipant.update({
        participantName: participantName || participantNumber,
        isAdmin,
        isSuperAdmin,
        profilePicUrl: groupParticipant.profilePicUrl || ""
      });
    }

    return groupParticipant;
  });

  const syncedParticipants = await Promise.all(participantPromises);

  // Atualiza cache
  await cacheLayer.set(cacheKey, Date.now().toString(), "EX", CACHE_TTL);

  logger.info(`Sincronizados ${syncedParticipants.length} participantes do grupo ${contactId}`);

  return syncedParticipants;
};

export default SyncGroupParticipantsService;

