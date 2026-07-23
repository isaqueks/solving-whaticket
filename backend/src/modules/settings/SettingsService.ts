import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { GetSettingFilters } from "./dtos/GetSettingFilters";
import { ListSettingsFilters } from "./dtos/ListSettingsFilters";
import { UpdateSettingDto } from "./dtos/UpdateSettingDto";
import Setting from "./models/Setting";
import { SettingsRepository } from "./SettingsRepository";

/**
 * Casos de uso do domínio Settings (doc 04 §§2–3). Absorve os 3 arquivos do
 * antigo `services/SettingServices/` e o helper `helpers/CheckSettings.ts`.
 * Regras de negócio preservadas; evento de domínio emitido via
 * RealtimeGateway (nunca `io.to` direto).
 */
export class SettingsService {
  constructor(
    private readonly repository = new SettingsRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async list(filters: ListSettingsFilters): Promise<Setting[]> {
    return this.repository.findAllByCompany(filters.companyId);
  }

  public async update(dto: UpdateSettingDto): Promise<Setting> {
    const { key, value, companyId } = dto;

    const setting = await this.repository.findOrCreate({
      key,
      value,
      companyId
    });

    if (setting.companyId !== companyId) {
      throw new AppError("Não é possível consultar registros de outra empresa");
    }

    const updated = await this.repository.update(setting, value);

    this.emitSettingEvent(companyId, { action: "update", setting: updated });

    return updated;
  }

  /**
   * Uma setting da empresa, opcionalmente filtrada por chave
   * (antigo ListSettingsServiceOne). Retorna null se não existir.
   */
  public async getByKey(filters: GetSettingFilters): Promise<Setting | null> {
    return this.repository.findOneByCompany(filters.companyId, filters.key);
  }

  /**
   * Valor de uma setting global por chave (antigo helper CheckSettings).
   * Lança ERR_NO_SETTING_FOUND (404) se a chave não existir.
   */
  public async getValue(key: string): Promise<string> {
    const setting = await this.repository.findByKey(key);

    if (!setting) {
      throw new AppError("ERR_NO_SETTING_FOUND", 404);
    }

    return setting.value;
  }

  private emitSettingEvent(companyId: number, payload: unknown): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companySettings(companyId),
      payload
    );
  }
}

/**
 * Singleton do serviço — usado por importadores de OUTROS domínios (users,
 * tickets, whatsapp-session) como default de injeção ou em tempo de chamada.
 */
export const settingsService = new SettingsService();
