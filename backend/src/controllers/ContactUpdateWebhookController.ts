import * as Yup from "yup";
import { Request, Response } from "express";

import AppError from "../errors/AppError";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import { logger } from "../utils/logger";

type StoreData = {
  data: {
    name: string;
    number: string;
    taxId?: string;
    email?: string;
    attachedToEmail?: string;
  }[];
  companyId: number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const data = req.body as StoreData;

  const schema = Yup.object().shape({
    name: Yup.string().required()
  });

  try {
    for (const item of data.data) {
      await schema.validate(item);
    }
  } catch (err: any) {
    throw new AppError(err.message);
  }

  for (const item of data.data) {
    try {
      await CreateOrUpdateContactService({
        ...item,
        email: item.email || '',
        taxId: item.taxId || '',
        companyId: data.companyId,
        isGroup: false
      });
    }
    catch (err) {
      logger.error(
        `Error syncing contact ${item.number || item.name}: ${err}`
      );
    }
  }

  return res.status(200).json({ message: "Contacts updated" });
};
