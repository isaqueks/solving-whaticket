/** Entrada de `CampaignsService.create` (antigo CreateService). */
export interface CreateCampaignDto {
  name: string;
  status: string;
  confirmation: boolean;
  scheduledAt: string;
  companyId: number;
  contactListId: number;
  message1?: string;
  message2?: string;
  message3?: string;
  message4?: string;
  message5?: string;
  confirmationMessage1?: string;
  confirmationMessage2?: string;
  confirmationMessage3?: string;
  confirmationMessage4?: string;
  confirmationMessage5?: string;
  fileListId: number;
}

/**
 * Corpo aceito pelo POST /campaigns: além dos campos persistidos, o frontend
 * pode mandar `tagListId` numérico para gerar a lista de contatos a partir de
 * uma tag (fluxo absorvido do controller antigo).
 */
export interface StoreCampaignBody extends CreateCampaignDto {
  tagListId: number | string;
}
