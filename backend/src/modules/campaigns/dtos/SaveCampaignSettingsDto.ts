/**
 * Corpo do POST /campaign-settings (antigo CampaignSettingServices/
 * CreateService): um mapa chave→valor; valores array/objeto são serializados
 * como JSON antes de persistir.
 */
export interface SaveCampaignSettingsDto {
  settings: Record<string, unknown>;
}
