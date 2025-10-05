import { Op } from "sequelize";
import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import { isNil } from "lodash";
import CheckContactNumber from "../WbotServices/CheckNumber";
import CreateTicketService from "../TicketServices/CreateTicketService";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import User from "../../models/User";
import { jidNormalizedUser } from "baileys";
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
  keepName?: boolean;
}

const CreateOrUpdateContactService = async ({
  name,
  number,
  profilePicUrl,
  isGroup,
  email,
  taxId,
  companyId,
  extraInfo = [],
  attachedToEmail,
  whatsappId,
  keepName = false
}: Request): Promise<Contact> => {

  const GP = isGroup || number.length > 13;
  number = GP ? number : number.replace(/[^0-9|-]/g, "");

  const io = getIO();
  let contact: Contact | null;

  const numRegex = /^(55[0-9][0-9])9([0-9]{8})$/;
  const oldNumRegex = /^(55[0-9][0-9])([0-9]{8})$/;

  const nums = [number];

  if (!GP) {

    if (numRegex.test(number)) {
      nums.push(number.replace(numRegex, "$1$2"));
    }
    else if (oldNumRegex.test(number)) {
      nums.push(number.replace(numRegex, "$19$2"));
    }
  }

  contact = await Contact.findOne({
    where: {
      number: {
        [Op.or]: nums
      },
      companyId
    }
  });

  if (contact) {
    if (keepName) {
      name = contact.name;
    }
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

    let n = GP ? number : null;

    if (!GP) {

      for (const nn of nums) {
        try {
          const onWhatsapp = await CheckContactNumber(nn, companyId);
          if (!onWhatsapp) {
            throw new Error(`Contact with number ${number} does not exist on WhatsApp.`);
          }
          n = nn;
          break;
        }
        catch { }
      }
      if (!n) {
        throw new Error(`Contact with number ${number} does not exist on WhatsApp.`);
      }
    }

    contact = await Contact.create({
      name,
      number: n,
      profilePicUrl,
      email,
      isGroup,
      extraInfo,
      companyId,
      taxId,
      whatsappId,
      attachedToEmail
    });

    if (!GP) {

      const correspondingUser = await User.findOne({
        where: {
          companyId,
          email: attachedToEmail
        }
      });

      if (correspondingUser) {
        const defaultWhatsapp = await GetDefaultWhatsApp(companyId);
        await CreateTicketService({
          contactId: contact.id,
          status: 'closed',
          companyId,
          whatsappId: String(defaultWhatsapp.id),
          userId: correspondingUser.id
        });
      }
    }

    // io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    //   action: "create",
    //   contact
    // });
  }

  return contact;
};

export default CreateOrUpdateContactService;
