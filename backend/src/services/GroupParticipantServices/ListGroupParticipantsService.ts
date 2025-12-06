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
    order: [["isSuperAdmin", "DESC"], ["isAdmin", "DESC"], ["participantName", "ASC"]]
  });

  return participants;
};

export default ListGroupParticipantsService;

