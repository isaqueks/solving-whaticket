import { Op } from "sequelize";
import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import CreateTicketService from "../TicketServices/CreateTicketService";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import User from "../../models/User";
import { getBrazilianNumberVariations, getOnWhatsappNumber } from "../../helpers/getOnWhatsappNumber";
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

  const variations = GP ? [number] : getBrazilianNumberVariations(number);

  let contact = await Contact.findOne({
    where: {
      number: {
        [Op.or]: variations
      },
      companyId
    }
  });

  const correctNumber = GP ? number : (await getOnWhatsappNumber(number, companyId));

  if (contact) {
    if (keepName) {
      name = contact.name;
    }
    contact.update({
      name, 
      profilePicUrl, 
      email, 
      taxId, 
      attachedToEmail,
      number: correctNumber || contact.number,
      whatsappId: whatsappId || contact.whatsappId
    });
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
      action: "update",
      contact
    });
  } else {

    if (!GP && !correctNumber) {
      throw new Error(`Contact with number ${number} does not exist on WhatsApp.`);
    }

    contact = await Contact.create({
      name,
      number: correctNumber,
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
  }

  return contact;
};

export default CreateOrUpdateContactService;
