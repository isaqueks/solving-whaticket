import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListContactsService from "../services/ContactServices/ListContactsService";
import CreateContactService from "../services/ContactServices/CreateContactService";
import ShowContactService from "../services/ContactServices/ShowContactService";
import UpdateContactService from "../services/ContactServices/UpdateContactService";
import DeleteContactService from "../services/ContactServices/DeleteContactService";
import GetContactService from "../services/ContactServices/GetContactService";

import ContactListItem from "../models/ContactListItem";

import AppError from "../errors/AppError";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";


type StoreData = {
  data: {
    name: string;
    number: string;
    taxId?: string;
    email?: string;
  }[];
  companyId: number;
};

type FindParams = {
  companyId: number;
  contactListId: number;
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
    await CreateOrUpdateContactService({
      ...item,
      companyId: data.companyId,
      isGroup: false
    });
  }

  // const io = getIO();
  // io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-ContactListItem`, {
  //   action: "update",
  //   record
  // });

  return res.status(200).json({ message: "Contacts updated" });
};

// export const store = async (req: Request, res: Response): Promise<Response> => {
//   const { companyId } = req.user;
//   const data = req.body as StoreData;

//   const schema = Yup.object().shape({
//     name: Yup.string().required()
//   });

//   try {
//     await schema.validate(data);
//   } catch (err: any) {
//     throw new AppError(err.message);
//   }

//   const record = await CreateService({
//     ...data,
//     companyId
//   });

//   const io = getIO();
//   io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-ContactListItem`, {
//     action: "create",
//     record
//   });

//   return res.status(200).json(record);
// };

// export const show = async (req: Request, res: Response): Promise<Response> => {
//   const { id } = req.params;

//   const record = await ShowService(id);

//   return res.status(200).json(record);
// };

// export const update = async (
//   req: Request,
//   res: Response
// ): Promise<Response> => {
//   const data = req.body as StoreData;
//   const { companyId } = req.user;

//   const schema = Yup.object().shape({
//     name: Yup.string().required()
//   });

//   try {
//     await schema.validate(data);
//   } catch (err: any) {
//     throw new AppError(err.message);
//   }

//   const { id } = req.params;

//   const record = await UpdateService({
//     ...data,
//     id
//   });

//   const io = getIO();
//   io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-ContactListItem`, {
//     action: "update",
//     record
//   });

//   return res.status(200).json(record);
// };

// export const remove = async (
//   req: Request,
//   res: Response
// ): Promise<Response> => {
//   const { id } = req.params;
//   const { companyId } = req.user;

//   await DeleteService(id);

//   const io = getIO();
//   io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-ContactListItem`, {
//     action: "delete",
//     id
//   });

//   return res.status(200).json({ message: "Contact deleted" });
// };

// export const findList = async (
//   req: Request,
//   res: Response
// ): Promise<Response> => {
//   const params = req.query as unknown as FindParams;
//   const records: ContactListItem[] = await FindService(params);

//   return res.status(200).json(records);
// };
