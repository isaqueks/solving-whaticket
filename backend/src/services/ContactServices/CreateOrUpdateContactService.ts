import { Op } from "sequelize";
import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import { isNil } from "lodash";
interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  companyId: number;
  extraInfo?: ExtraInfo[];
  whatsappId?: number;
  taxId?: string;
  attachedToEmail?: string;
}

const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  profilePicUrl,
  isGroup,
  email,
  taxId,
  companyId,
  extraInfo = [],
  attachedToEmail,
  whatsappId
}: Request): Promise<Contact> => {
  const GP = isGroup || rawNumber.length > 13;
  const number = GP ? rawNumber : rawNumber.replace(/[^0-9|-]/g, "");

  const io = getIO();
  let contact: Contact | null;

  const numRegex = /^(55[0-9][0-9])9([0-9]{8})$/;

  contact = await Contact.findOne({
    where: {
      number: numRegex.test(number) ? {
        [Op.or]: [number.replace(numRegex, "$1$2"), number]
      } : number,
      companyId
    }
  });

  if (contact) {
    contact.update({ name, profilePicUrl, email, taxId, attachedToEmail });
    console.log(contact.whatsappId)
    if (isNil(contact.whatsappId === null)) {
      contact.update({
        whatsappId
      });
    }
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
      action: "update",
      contact
    });
  } else {
    contact = await Contact.create({
      name,
      number: numRegex.test(number) ? number.replace(numRegex, "$1$2") : number,
      profilePicUrl,
      email,
      isGroup,
      extraInfo,
      companyId,
      taxId,
      whatsappId,
      attachedToEmail
    });

    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
      action: "create",
      contact
    });
  }

  return contact;
};

export default CreateOrUpdateContactService;
