import Setting from "./models/Setting";

/** Atributos persistíveis de Setting (subset usado pelo domínio). */
export interface SettingAttributes {
  key: string;
  value: string;
  companyId: number;
}

/**
 * Único ponto de acesso ao model do domínio (doc 04 §3): Setting.
 * Não emite socket nem lança erro de negócio — retorna dados/null e o
 * service decide.
 */
export class SettingsRepository {
  public async findAllByCompany(companyId: number): Promise<Setting[]> {
    return Setting.findAll({ where: { companyId } });
  }

  /**
   * Uma setting da empresa, opcionalmente filtrada por chave
   * (comportamento do antigo ListSettingsServiceOne).
   */
  public async findOneByCompany(
    companyId: number,
    key?: string
  ): Promise<Setting | null> {
    return Setting.findOne({
      where: {
        companyId,
        ...(key && { key })
      }
    });
  }

  /** Busca global por chave, sem escopo de empresa (antigo helper CheckSettings). */
  public async findByKey(key: string): Promise<Setting | null> {
    return Setting.findOne({ where: { key } });
  }

  /** Cria a setting se a combinação chave+empresa não existir. */
  public async findOrCreate(attributes: SettingAttributes): Promise<Setting> {
    const { key, value, companyId } = attributes;

    const [setting] = await Setting.findOrCreate({
      where: { key, companyId },
      defaults: { key, value, companyId }
    });

    return setting;
  }

  public async update(setting: Setting, value: string): Promise<Setting> {
    await setting.update({ value });

    return setting;
  }
}
