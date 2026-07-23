import { Request, Response } from "express";
import { head } from "lodash";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
// Import de contatos do TELEFONE é orquestração da sessão wbot
// (modules/whatsapp-session); o controller só delega, como antes
// (antigo ImportPhoneContactsController).
import { phoneContactsImporter } from "../whatsapp-session/PhoneContactsImporter";
import { ContactsService } from "./ContactsService";
import { CreateContactDto } from "./dtos/CreateContactDto";
import { SyncContactsWebhookDto } from "./dtos/SyncContactsWebhookDto";
import { UpdateContactDto } from "./dtos/UpdateContactDto";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  group?: string;
};

type IndexGetContactQuery = {
  name: string;
  number: string;
};

type ListQuery = {
  name?: string;
};

/** Contrato mínimo de schema Yup aceito pelo guard de validação. */
interface ValidatableSchema {
  validate(value: unknown): Promise<unknown>;
}

/**
 * Controller fino (doc 04 §3): parse da requisição, validação Yup no
 * boundary e status code — checagens wbot, número canônico e eventos
 * realtime (que moravam aqui no controller gordo) desceram para o service.
 *
 * Convenção do template (B1): handlers são ARROW PROPERTIES da classe —
 * `this` já fica preso à instância, dispensando `.bind` no arquivo de rotas.
 */
export class ContactsController {
  constructor(private readonly service = new ContactsService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam, pageNumber, group } = req.query as IndexQuery;
    const { companyId } = req.user;

    const { contacts, count, hasMore } = await this.service.list({
      searchParam,
      pageNumber,
      companyId,
      group
    });

    return res.json({ contacts, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const newContact = req.body as Omit<CreateContactDto, "companyId">;
    // Normalização original: remove apenas a PRIMEIRA ocorrência de "-" e " ".
    newContact.number = newContact.number.replace("-", "").replace(" ", "");

    await this.validateSchema(
      Yup.object().shape({
        name: Yup.string().required(),
        number: Yup.string()
          .required()
          .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
      }),
      newContact
    );

    const contact = await this.service.store({ ...newContact, companyId });

    return res.status(200).json(contact);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { contactId } = req.params;
    const { companyId } = req.user;

    const contact = await this.service.show(contactId, companyId);

    return res.status(200).json(contact);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const contactData = req.body as UpdateContactDto;
    const { companyId } = req.user;

    await this.validateSchema(
      Yup.object().shape({
        name: Yup.string(),
        number: Yup.string().matches(
          /^\d+$/,
          "Invalid number format. Only numbers is allowed."
        )
      }),
      contactData
    );

    const { contactId } = req.params;

    const contact = await this.service.update(contactId, contactData, companyId);

    return res.status(200).json(contact);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { contactId } = req.params;
    const { companyId } = req.user;

    await this.service.remove(contactId, companyId);

    return res.status(200).json({ message: "Contact deleted" });
  };

  public list = async (req: Request, res: Response): Promise<Response> => {
    const { name } = req.query as ListQuery;
    const { companyId } = req.user;

    const contacts = await this.service.simpleList({ name, companyId });

    return res.json(contacts);
  };

  public upload = async (req: Request, res: Response): Promise<Response> => {
    const files = req.files as Express.Multer.File[];
    const file = head(files) as Express.Multer.File;
    const { companyId } = req.user;

    const response = await this.service.importFromFile(companyId, file);

    return res.status(200).json(response);
  };

  public getContactVcard = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { name, number } = req.query as IndexGetContactQuery;
    const { companyId } = req.user;

    const contact = await this.service.getOrCreate({ name, number, companyId });

    return res.status(200).json(contact);
  };

  /** POST /contacts/import — importa os contatos do telefone via wbot. */
  public importPhone = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { companyId } = req.user;

    await phoneContactsImporter.importFromPhone(companyId);

    return res.status(200).json({ message: "contacts imported" });
  };

  /**
   * POST /webhook/contacts/sync — integração CUSTOM do dono (antigo
   * ContactUpdateWebhookController.index). Comportamento CONGELADO: valida
   * todos os itens antes (primeiro inválido → 400), depois sincroniza item a
   * item seguindo no erro; resposta fixa `{ message: "Contacts updated" }`.
   */
  public syncWebhook = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const data = req.body as SyncContactsWebhookDto;

    const schema = Yup.object().shape({
      name: Yup.string().required()
    });

    for (const item of data.data) {
      await this.validateSchema(schema, item);
    }

    await this.service.syncFromWebhook(data);

    return res.status(200).json({ message: "Contacts updated" });
  };

  /** Converte falha de validação Yup em AppError 400 (padrão original). */
  private async validateSchema(
    schema: ValidatableSchema,
    payload: unknown
  ): Promise<void> {
    try {
      await schema.validate(payload);
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : String(err));
    }
  }
}
