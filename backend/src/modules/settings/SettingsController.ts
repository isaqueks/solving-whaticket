import { Request, Response } from "express";

import AppError from "../../shared/errors/AppError";
import { UpdateSettingDto } from "./dtos/UpdateSettingDto";
import { SettingsService } from "./SettingsService";

/**
 * Controller fino (doc 04 §3): parse da requisição, permissão e status code —
 * negócio (incluindo a emissão de realtime) fica no service.
 *
 * Convenção do template (B1): handlers são ARROW PROPERTIES da classe —
 * `this` já fica preso à instância, dispensando `.bind` no arquivo de rotas.
 */
export class SettingsController {
  constructor(private readonly service = new SettingsService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;

    // Permissão de admin comentada no controller original — preservado.
    const settings = await this.service.list({ companyId });

    return res.status(200).json(settings);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    this.ensureAdmin(req);

    const { settingKey: key } = req.params;
    const { value } = req.body as Pick<UpdateSettingDto, "value">;
    const { companyId } = req.user;

    const setting = await this.service.update({ key, value, companyId });

    return res.status(200).json(setting);
  };

  private ensureAdmin(req: Request): void {
    if (req.user.profile !== "admin") {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }
}
