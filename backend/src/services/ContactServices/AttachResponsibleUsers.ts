import { Op, fn, col, where } from "sequelize";
import Contact from "../../models/Contact";
import User from "../../models/User";

export interface ResponsibleUser {
  id: number;
  name: string;
  email: string;
}

/**
 * Resolve o colaborador responsável (Contacts.attachedToEmail) de cada contato
 * e grava em `contact.attachedUser` ({ id, name, email }) para o frontend.
 *
 * O vínculo é por e-mail, então a resolução é feita em uma única consulta de
 * usuários da empresa. Contatos sem responsável (ou cujo e-mail não tem usuário
 * cadastrado) ficam com `attachedUser = null`.
 */
const AttachResponsibleUsers = async (
  contacts: Array<Contact | null | undefined>,
  companyId: number
): Promise<void> => {
  const emails = new Set<string>();
  contacts.forEach(contact => {
    const email = contact?.attachedToEmail?.trim().toLowerCase();
    if (email) emails.add(email);
  });

  let byEmail = new Map<string, ResponsibleUser>();

  if (emails.size > 0) {
    const users = await User.findAll({
      where: {
        companyId,
        [Op.and]: [where(fn("LOWER", col("email")), { [Op.in]: [...emails] })]
      },
      attributes: ["id", "name", "email"]
    });

    byEmail = new Map(
      users.map(u => [
        u.email.toLowerCase(),
        { id: u.id, name: u.name, email: u.email }
      ])
    );
  }

  contacts.forEach(contact => {
    if (!contact) return;
    const email = contact.attachedToEmail?.trim().toLowerCase();
    contact.setDataValue(
      "attachedUser" as any,
      (email && byEmail.get(email)) || null
    );
  });
};

export default AttachResponsibleUsers;
