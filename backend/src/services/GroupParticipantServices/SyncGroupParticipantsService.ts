import { GroupMetadata } from "baileys";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import GroupParticipant from "../../models/GroupParticipant";
import { cacheLayer } from "../../libs/cache";
import { getContactJid } from "../../helpers/getContactJid";
import { logger } from "../../utils/logger";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";

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

// Extrai number e lidNumber de um JID de participante
const extractParticipantInfo = (jid: string): { number?: string; lidNumber?: string } => {
  const result: { number?: string; lidNumber?: string } = {};
  
  if (jid.endsWith('@lid')) {
    result.lidNumber = jid.replace('@lid', '');
  } else if (jid.includes('@s.whatsapp.net')) {
    result.number = jid.split('@')[0].split(':')[0];
  } else if (jid.includes('@lid')) {
    result.lidNumber = jid.split('@')[0];
  }
  
  return result;
};

// Normaliza JID para comparação (remove sufixos e normaliza formato)
const normalizeJid = (jid: string): string => {
  if (!jid) return "";
  // Remove sufixos comuns
  return jid.split('@')[0].split(':')[0];
};

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
      const cachedParticipants = await GroupParticipant.findAll({
        where: { groupContactId: contactId },
        include: [{ model: Contact, as: "participantContact" }]
      });
      
      // Ordena manualmente
      return cachedParticipants.sort((a, b) => {
        if (a.isSuperAdmin !== b.isSuperAdmin) {
          return b.isSuperAdmin ? 1 : -1;
        }
        if (a.isAdmin !== b.isAdmin) {
          return b.isAdmin ? 1 : -1;
        }
        const nameA = a.participantContact?.name || "";
        const nameB = b.participantContact?.name || "";
        return nameA.localeCompare(nameB);
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
  
  // Extrai JIDs dos participantes atuais para comparação
  const currentParticipantJids = participants.map(p => {
    return typeof p === "string" ? p : p.id;
  });

  // Busca todos os participantes atuais do grupo no banco
  const existingGroupParticipants = await GroupParticipant.findAll({
    where: { groupContactId: contactId },
    include: [{ model: Contact, as: "participantContact" }]
  });

  // Identifica participantes que não estão mais no grupo (por JID)
  const normalizedCurrentJids = currentParticipantJids.map(jid => normalizeJid(jid));
  
  const participantsToRemove = existingGroupParticipants.filter(gp => {
    if (!gp.participantContact) return true;
    const contactJid = getContactJid(gp.participantContact);
    const normalizedContactJid = normalizeJid(contactJid);
    return !normalizedCurrentJids.includes(normalizedContactJid);
  });

  // Remove participantes que não estão mais no grupo
  if (participantsToRemove.length > 0) {
    await GroupParticipant.destroy({
      where: {
        id: { [Op.in]: participantsToRemove.map(p => p.id) }
      }
    });
  }

  // Cria ou atualiza participantes
  const participantPromises = participants.map(async (participant) => {
    const jid = typeof participant === "string" ? participant : participant.id;
    
    // Extrai informações do participante
    const { number, lidNumber } = extractParticipantInfo(jid);
    
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

    // Busca ou cria Contact do participante
    let participantContact: Contact;
    
    try {
      // Tenta buscar por lidNumber primeiro, depois por number
      if (lidNumber) {
        participantContact = await Contact.findOne({
          where: {
            lidNumber,
            companyId: contact.companyId
          }
        });
      }
      
      if (!participantContact && number) {
        participantContact = await Contact.findOne({
          where: {
            number: number.replace(/[^0-9|-]/g, ""),
            companyId: contact.companyId,
            isGroup: false
          }
        });
      }

      // Se não encontrou, cria novo Contact
      if (!participantContact) {
        if (!number && !lidNumber) {
          logger.warn(`Não foi possível criar Contact para participante com JID: ${jid}`);
          return null;
        }

        participantContact = await CreateOrUpdateContactService({
          name: participantName || number || lidNumber || "Sem nome",
          number: number ? number.replace(/[^0-9|-]/g, "") : undefined,
          lidNumber,
          isGroup: false,
          companyId: contact.companyId,
          whatsappId: contact.whatsappId,
          addressingMode: lidNumber ? "lid" : "pn"
        });
      } else {
        // Atualiza nome se necessário
        if (participantName && participantContact.name !== participantName) {
          await participantContact.update({ name: participantName });
        }
      }
    } catch (error) {
      logger.error(`Erro ao criar/buscar Contact para participante ${jid}:`, error);
      return null;
    }

    // Busca ou cria GroupParticipant
    const [groupParticipant, created] = await GroupParticipant.findOrCreate({
      where: {
        groupContactId: contactId,
        participantContactId: participantContact.id
      },
      defaults: {
        isAdmin,
        isSuperAdmin,
        companyId: contact.companyId
      }
    });

    // Atualiza se já existia
    if (!created) {
      await groupParticipant.update({
        isAdmin,
        isSuperAdmin
      });
    }

    return groupParticipant;
  });

  const syncedParticipants = (await Promise.all(participantPromises)).filter(p => p !== null) as GroupParticipant[];

  // Atualiza cache
  await cacheLayer.set(cacheKey, Date.now().toString(), "EX", CACHE_TTL);

  logger.info(`Sincronizados ${syncedParticipants.length} participantes do grupo ${contactId}`);

  // Retorna participantes com Contact incluído
  const allParticipants = await GroupParticipant.findAll({
    where: { groupContactId: contactId },
    include: [{ model: Contact, as: "participantContact" }]
  });
  
  // Ordena manualmente
  return allParticipants.sort((a, b) => {
    if (a.isSuperAdmin !== b.isSuperAdmin) {
      return b.isSuperAdmin ? 1 : -1;
    }
    if (a.isAdmin !== b.isAdmin) {
      return b.isAdmin ? 1 : -1;
    }
    const nameA = a.participantContact?.name || "";
    const nameB = b.participantContact?.name || "";
    return nameA.localeCompare(nameB);
  });
};

export default SyncGroupParticipantsService;

