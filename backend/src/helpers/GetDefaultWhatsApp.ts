import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import GetDefaultWhatsAppByUser from "./GetDefaultWhatsAppByUser";

const findConnectedWhatsapp = async (companyId: number): Promise<Whatsapp> =>
  Whatsapp.findOne({
    where: { status: "CONNECTED", companyId },
    attributes: { exclude: ["session"] }
  });

const GetDefaultWhatsApp = async (
  companyId: number,
  userId?: number
): Promise<Whatsapp> => {
  if (userId) {
    const whatsappByUser = await GetDefaultWhatsAppByUser(userId);
    if (whatsappByUser?.status === "CONNECTED") {
      return whatsappByUser;
    }

    const connected = await findConnectedWhatsapp(companyId);
    if (!connected) {
      throw new AppError(`ERR_NO_DEF_WAPP_FOUND in COMPANY ${companyId}`);
    }
    return connected;
  }

  const defaultWhatsapp = await Whatsapp.findOne({
    where: { isDefault: true, companyId },
    attributes: { exclude: ["session"] }
  });

  if (defaultWhatsapp?.status === "CONNECTED") {
    return defaultWhatsapp;
  }

  const connected = await findConnectedWhatsapp(companyId);
  if (!connected) {
    throw new AppError(`ERR_NO_DEF_WAPP_FOUND in COMPANY ${companyId}`);
  }
  return connected;
};

export default GetDefaultWhatsApp;
