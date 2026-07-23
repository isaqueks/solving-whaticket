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

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes cache
const MAX_CACHE_SIZE = 5000;

// Stores an entry while keeping the cache bounded. Maps preserve insertion
// order, so when the cap is reached we evict the oldest entries first.
function setCacheItem<T>(
  cache: Map<string, CacheItem<T>>,
  key: string,
  data: T
): void {
  if (!cache.has(key) && cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { data, timestamp: Date.now() });
}

const lidCache: Map<string, CacheItem<Contact>> = new Map<string, CacheItem<Contact>>();

async function getCachedContactByLidNumber(lidNumber: string, companyId: number): Promise<Contact | null> {
  const cacheKey = `${companyId};${lidNumber}`;
  if (lidCache.has(cacheKey)) {
    const cached = lidCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return cached.data;
    }
    lidCache.delete(cacheKey); // stale entry, drop it
  }

  const ctt = await Contact.findOne({
    where: {
      lidNumber,
      companyId
    }
  });

  if (ctt) {
    setCacheItem(lidCache, cacheKey, ctt);
  }

  return ctt;
}

const numbersCache: Map<string, CacheItem<Contact>> = new Map<string, CacheItem<Contact>>();

async function getCachedByNumber(numbers: string[], companyId: number): Promise<Contact> {
  const cacheKey = `${companyId};${numbers.join(",")}`;

  if (numbersCache.has(cacheKey)) {
    const cached = numbersCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return cached.data;
    }
    numbersCache.delete(cacheKey); // stale entry, drop it
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
    setCacheItem(numbersCache, cacheKey, ctt);
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
      number: contact.number,
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

    const correctNumber = GP ? number : (await getOnWhatsappNumber(number, companyId));

    if (!correctNumber) {
      throw new Error(`Contact with number ${number} does not exist on WhatsApp.`);
    }

    // findOrCreate guards against the duplicate-contact race: when two
    // concurrent messages from a brand-new number both miss the lookup above,
    // the composite unique constraint (number, companyId) would make the second
    // Contact.create throw. findOrCreate resolves that atomically and returns
    // whether this call actually created the row.
    const [createdContact, created] = await Contact.findOrCreate({
      where: {
        number: correctNumber,
        companyId
      },
      defaults: {
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
      }
    });

    contact = createdContact;

    if (created && !GP && attachedToEmail) {

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
