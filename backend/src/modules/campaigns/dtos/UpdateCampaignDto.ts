import { CreateCampaignDto } from "./CreateCampaignDto";

/** Entrada de `CampaignsService.update` (antigo UpdateService). */
export interface UpdateCampaignDto extends CreateCampaignDto {
  id: number | string;
}
