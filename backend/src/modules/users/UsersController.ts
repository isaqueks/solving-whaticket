import { Request, Response } from "express";
import * as Yup from "yup";

import {
  SettingsService,
  settingsService
} from "../settings/SettingsService";
import AppError from "../../shared/errors/AppError";
import { CreateUserDto } from "./dtos/CreateUserDto";
import { UpdateUserDto } from "./dtos/UpdateUserDto";
import { UsersService } from "./UsersService";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
};

type ListQuery = {
  companyId?: string;
};

type StoreBody = {
  email: string;
  password: string;
  name: string;
  profile?: string;
  companyId?: number;
  queueIds?: number[];
  whatsappId?: number;
  allTicket?: string;
};

/** Contrato mínimo de schema Yup aceito pelo guard de validação. */
interface ValidatableSchema {
  validate(value: unknown): Promise<unknown>;
}

/**
 * Controller fino (doc 04 §3): parse da requisição, validação Yup no boundary,
 * permissão e status code — negócio fica no service.
 *
 * Convenção do template (B1): handlers são ARROW PROPERTIES da classe — `this`
 * já fica preso à instância, dispensando `.bind` no arquivo de rotas.
 */
export class UsersController {
  constructor(
    private readonly service = new UsersService(),
    private readonly settings: SettingsService = settingsService
  ) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam, pageNumber } = req.query as IndexQuery;
    const { companyId, profile } = req.user;

    const { users, count, hasMore } = await this.service.list({
      searchParam,
      pageNumber,
      companyId,
      profile
    });

    return res.json({ users, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const {
      email,
      password,
      name,
      profile,
      companyId: bodyCompanyId,
      queueIds,
      whatsappId,
      allTicket
    } = req.body as StoreBody;

    const actingCompanyId = req.user?.companyId ?? null;
    const newUserCompanyId = bodyCompanyId || actingCompanyId;
    const isSignup = req.url === "/signup";

    await this.ensureCanCreate(req, isSignup, newUserCompanyId);

    await this.validateSchema(
      Yup.object().shape({
        name: Yup.string().required().min(2),
        email: Yup.string().email().required(),
        password: Yup.string().required().min(5)
      }),
      { name, email, password }
    );

    const dto: CreateUserDto = {
      email,
      password,
      name,
      profile,
      companyId: newUserCompanyId,
      queueIds,
      whatsappId,
      allTicket
    };

    const user = await this.service.create(dto, actingCompanyId);

    return res.status(200).json(user);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { userId } = req.params;

    const user = await this.service.show(userId);

    return res.status(200).json(user);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    this.ensureAdmin(req);

    const { id: requestUserId, companyId } = req.user;
    const { userId } = req.params;
    const userData = req.body as UpdateUserDto;

    await this.validateSchema(
      Yup.object().shape({
        name: Yup.string().min(2),
        email: Yup.string().email(),
        profile: Yup.string(),
        password: Yup.string(),
        allTicket: Yup.string()
      }),
      {
        name: userData.name,
        email: userData.email,
        profile: userData.profile,
        password: userData.password,
        allTicket: userData.allTicket
      }
    );

    const user = await this.service.update(
      userId,
      userData,
      companyId,
      +requestUserId
    );

    return res.status(200).json(user);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    this.ensureAdmin(req);

    const { userId } = req.params;
    const { companyId } = req.user;

    await this.service.delete(userId, companyId);

    return res.status(200).json({ message: "User deleted" });
  };

  public list = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.query as ListQuery;
    const { companyId: userCompanyId } = req.user;

    const users = await this.service.simpleList({
      companyId: companyId ? +companyId : userCompanyId
    });

    return res.status(200).json(users);
  };

  /**
   * Guard de criação (preserva o fluxo original do controller): /signup
   * respeita a configuração `userCreation`; nas demais rotas exige admin e,
   * para criar em outra empresa, exige `super`.
   */
  private async ensureCanCreate(
    req: Request,
    isSignup: boolean,
    newUserCompanyId: number | null
  ): Promise<void> {
    if (isSignup) {
      if ((await this.settings.getValue("userCreation")) === "disabled") {
        throw new AppError("ERR_USER_CREATION_DISABLED", 403);
      }
      return;
    }

    if (req.user?.profile !== "admin") {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    if (newUserCompanyId !== req.user?.companyId) {
      const isSuper = req.user ? await this.service.isSuper(req.user.id) : false;
      if (!isSuper) {
        throw new AppError("ERR_NO_SUPER", 403);
      }
    }
  }

  private ensureAdmin(req: Request): void {
    if (req.user.profile !== "admin") {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

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
