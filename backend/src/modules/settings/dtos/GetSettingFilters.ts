/**
 * Entrada de `SettingsService.getByKey` (busca uma setting da empresa,
 * opcionalmente filtrada por chave). Absorve o antigo `ListSettingsServiceOne`.
 */
export interface GetSettingFilters {
  companyId: number;
  key?: string;
}
