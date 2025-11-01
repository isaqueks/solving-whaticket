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
  addressingMode?: string;
  lidNumber?: string;
}

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const lidCache: Map<string, CacheItem<Contact>> = new Map<string, CacheItem<Contact>>();

async function getCachedContactByLidNumber(lidNumber: string, companyId: number): Promise<Contact | null> {
  const cacheKey = `${companyId};${lidNumber}`;
  if (lidCache.has(cacheKey)) {
    const cached = lidCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < 1000 * 60 * 5) { // 5 minutes cache
      return cached.data;
    }
  }

  const ctt = await Contact.findOne({
    where: {
      lidNumber,
      companyId
    }
  });

  if (ctt) {
    lidCache.set(cacheKey, { data: ctt, timestamp: Date.now() });
  }

  return ctt;
}

const numbersCache: Map<string, CacheItem<Contact>> = new Map<string, CacheItem<Contact>>();

async function getCachedByNumber(numbers: string[], companyId: number): Promise<Contact> {
  const cacheKey = `${companyId};${numbers.join(",")}`;

  if (numbersCache.has(cacheKey)) {
    const cached = numbersCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < 1000 * 60 * 5) { // 5 minutes cache
      return cached.data;
    }
  }

  const ctt = await Contact.findOne({
    where: {
      number: {
        [Op.or]: numbers
      },
      companyId
    }
  });

  if (ctt) {
    numbersCache.set(cacheKey, { data: ctt, timestamp: Date.now() });
    return ctt;
  }

  return ctt;

}

const CreateOrUpdateContactService = async (data: Request): Promise<Contact> => {
  let {
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
    keepName = false,
    addressingMode,
    lidNumber
  } = data;

  if (!number) {
    if (!lidNumber) {
      throw new Error("Number or LID Number is required to create or update a contact.");
    }

    const existing = await getCachedContactByLidNumber(lidNumber, companyId);

    if (existing) {
      number = existing.number;
    }
    else {
      throw new Error("Number is required to create or update a contact when LID Number does not exist.");
    }
  }

  const GP = isGroup || (number && number.length > 13);
  number = GP ? number : number.replace(/[^0-9|-]/g, "");

  const io = getIO();

  const variations = GP ? [number] : getBrazilianNumberVariations(number);

  let contact = await getCachedByNumber(variations, companyId);

  const correctNumber = GP ? number : (await getOnWhatsappNumber(number, companyId));

  console.log('Correct number found:', correctNumber, 'for input number:', number);
  console.log('Variations considered:', variations);
  console.log('Is Group:', GP);

  if (contact) {
    if (keepName) {
      name = contact.name;
    }

    const dto: Partial<Contact> = {
      name,
      profilePicUrl,
      email: email || contact.email || '',
      taxId,
      attachedToEmail,
      number: correctNumber || contact.number,
      whatsappId: whatsappId || contact.whatsappId,
      addressingMode: addressingMode || contact.addressingMode,
      lidNumber: lidNumber || contact.lidNumber
    };

    if (
      contact.name !== dto.name ||
      contact.profilePicUrl !== dto.profilePicUrl ||
      contact.email !== dto.email ||
      contact.taxId !== dto.taxId ||
      contact.attachedToEmail !== dto.attachedToEmail ||
      contact.number !== dto.number ||
      contact.whatsappId !== dto.whatsappId ||
      contact.addressingMode !== dto.addressingMode ||
      contact.lidNumber !== dto.lidNumber
    ) {
      await contact.update(dto);
      io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
        action: "update",
        contact
      });
    }

  } else {

    if (!correctNumber) {
      throw new Error(`Contact with number ${number} does not exist on WhatsApp.`);
    }

    contact = await Contact.create({
      name,
      number: correctNumber,
      profilePicUrl,
      email: email || '',
      isGroup,
      extraInfo,
      companyId,
      taxId,
      whatsappId,
      attachedToEmail,
      addressingMode,
      lidNumber
    });

    if (!GP && attachedToEmail) {

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
