/** Entrada de `SettingsService.update` (doc 04 §4). */
export interface UpdateSettingDto {
  key: string;
  value: string;
  companyId: number;
}
