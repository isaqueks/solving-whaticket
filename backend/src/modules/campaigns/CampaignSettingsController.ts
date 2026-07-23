import { Request, Response } from "express";

import { SaveCampaignSettingsDto } from "./dtos/SaveCampaignSettingsDto";
import { CampaignsService, campaignsService } from "./CampaignsService";

/**
 * Controller fino das configurações de campanha (antigo
 * CampaignSettingController): GET/POST /campaign-settings. Handlers são
 * ARROW PROPERTIES (convenção do template B1).
 */
export class CampaignSettingsController {
  constructor(private readonly service: CampaignsService = campaignsService) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;

    const records = await this.service.listSettings(companyId);

    return res.json(records);
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const data = req.body as SaveCampaignSettingsDto;

    const record = await this.service.saveSettings(data, companyId);

    return res.status(200).json(record);
  };
}
