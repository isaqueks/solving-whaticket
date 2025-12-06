import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import GroupParticipant from "../../models/GroupParticipant";

interface Request {
  contactId: number;
}

const ListGroupParticipantsService = async ({
  contactId
}: Request): Promise<GroupParticipant[]> => {
  const contact = await Contact.findByPk(contactId);

  if (!contact) {
    throw new AppError("Contato não encontrado", 404);
  }

  if (!contact.isGroup) {
    throw new AppError("O contato não é um grupo", 400);
  }

  const participants = await GroupParticipant.findAll({
    where: { groupContactId: contactId },
    include: [{ model: Contact, as: "participantContact" }]
  });

  // Ordena manualmente
  return participants.sort((a, b) => {
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

export default ListGroupParticipantsService;

