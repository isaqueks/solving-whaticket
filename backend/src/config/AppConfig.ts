import "../bootstrap";

import { logger } from "../utils/logger";

/**
 * Acesso centralizado às variáveis de ambiente (doc 04 §8).
 *
 * Regras:
 * - `process.env` só é lido aqui (exceções documentadas: `bootstrap.ts`, que é
 *   o próprio carregador do dotenv, e `config/database.ts`, mantido standalone
 *   para o sequelize-cli).
 * - Importar este módulo NUNCA lança erro — scripts (ex.:
 *   `scripts/exportLastContactCsv.ts`) importam config sem o env completo.
 *   A checagem de obrigatórias acontece apenas em `validate(scope)`.
 * - Os defaults preservam EXATAMENTE o comportamento anterior de cada leitor.
 */

/** Escopo de validação: "server" exige tudo; "database" só as chaves de banco. */
export type ConfigScope = "server" | "database";

interface ServerConfig {
  readonly nodeEnv: string | undefined;
  /** Porta HTTP como string (uso original: `app.listen(process.env.PORT)`). */
  readonly port: string | undefined;
  readonly mainPort: string | undefined;
  /**
   * Comparação de strings idêntica à original
   * (`process.env.PORT === process.env.MAIN_PORT`), inclusive o caso em que
   * ambas estão ausentes (undefined === undefined → true).
   */
  readonly isMainInstance: boolean;
  readonly frontendUrl: string | undefined;
  readonly backendUrl: string | undefined;
  readonly proxyPort: string | undefined;
  readonly sentryDsn: string | undefined;
}

interface DatabaseConfig {
  readonly dialect: string;
  readonly host: string | undefined;
  readonly port: number;
  readonly name: string | undefined;
  readonly user: string | undefined;
  readonly password: string | undefined;
  readonly debug: boolean;
}

interface RedisConfig {
  readonly uri: string;
  readonly limiterMax: number;
  readonly limiterDuration: number;
}

interface AuthConfig {
  readonly jwtSecret: string;
  readonly jwtRefreshSecret: string;
  readonly checkAuthEndpoint: string | undefined;
  readonly envToken: string | undefined;
  readonly contactSyncToken: string | undefined;
  readonly publicApiKey: string | undefined;
}

interface MailConfig {
  readonly host: string | undefined;
  readonly user: string | undefined;
  readonly password: string | undefined;
  readonly from: string | undefined;
  /** `Number(process.env.MAIL_PORT)` — NaN quando ausente, como antes. */
  readonly port: number;
}

interface WppConfig {
  /** JSON cru de WPP_VERSION; o parse continua no ponto de uso (SessionManager). */
  readonly versionJson: string | undefined;
  readonly receiveMessageUrl: string | undefined;
  readonly receiveMessageToken: string | undefined;
  readonly receiveMessageDedupMs: number;
  readonly messageWebhookUrl: string | undefined;
}

export class AppConfig {
  public readonly server: ServerConfig;

  public readonly db: DatabaseConfig;

  public readonly redis: RedisConfig;

  public readonly auth: AuthConfig;

  public readonly mail: MailConfig;

  public readonly wpp: WppConfig;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    this.server = {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      mainPort: env.MAIN_PORT,
      isMainInstance: env.PORT === env.MAIN_PORT,
      frontendUrl: env.FRONTEND_URL,
      backendUrl: env.BACKEND_URL,
      proxyPort: env.PROXY_PORT,
      sentryDsn: env.SENTRY_DSN
    };

    this.db = {
      dialect: env.DB_DIALECT || "postgres",
      host: env.DB_HOST,
      port: Number(env.DB_PORT || 3306),
      name: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASS,
      debug: env.DB_DEBUG === "true"
    };

    this.redis = {
      uri: env.REDIS_URI || "",
      limiterMax: Number(env.REDIS_OPT_LIMITER_MAX || 1),
      limiterDuration: Number(env.REDIS_OPT_LIMITER_DURATION || 3000)
    };

    this.auth = {
      jwtSecret: env.JWT_SECRET || "mysecret",
      jwtRefreshSecret: env.JWT_REFRESH_SECRET || "myanothersecret",
      checkAuthEndpoint: env.CHECK_AUTH_ENDPOINT,
      envToken: env.ENV_TOKEN,
      contactSyncToken: env.CONTACT_SYNC_TOKEN,
      publicApiKey: env.PUBLIC_API_KEY
    };

    this.mail = {
      host: env.MAIL_HOST,
      user: env.MAIL_USER,
      password: env.MAIL_PASS,
      from: env.MAIL_FROM,
      port: Number(env.MAIL_PORT)
    };

    this.wpp = {
      versionJson: env.WPP_VERSION,
      receiveMessageUrl: env.WPP_RECEIVE_MESSAGE_URL,
      receiveMessageToken: env.WPP_RECEIVE_MESSAGE_TOKEN,
      receiveMessageDedupMs: Number(
        env.WPP_RECEIVE_MESSAGE_DEDUP_MS || 5 * 60 * 1000
      ),
      messageWebhookUrl: env.MESSAGE_WEBHOOK
    };
  }

  public get isProduction(): boolean {
    return this.server.nodeEnv === "production";
  }

  public get isTest(): boolean {
    return this.server.nodeEnv === "test";
  }

  /**
   * Valida a presença das variáveis obrigatórias para o escopo dado.
   * Loga um fatal claro (lista das ausentes) e lança — deve ser chamada no
   * boot (`server.ts`) ou no início de scripts, nunca no import.
   */
  public validate(scope: ConfigScope = "server"): void {
    const missing = this.missingRequiredKeys(scope);
    if (missing.length === 0) {
      return;
    }

    const message =
      `Configuração inválida (escopo "${scope}"): variáveis de ambiente ` +
      `obrigatórias ausentes: ${missing.join(", ")}. ` +
      "Defina-as no arquivo .env antes de iniciar.";
    logger.fatal(message);
    throw new Error(message);
  }

  private missingRequiredKeys(scope: ConfigScope): string[] {
    const databaseKeys = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASS"];
    const serverKeys = [...databaseKeys, "REDIS_URI", "CHECK_AUTH_ENDPOINT"];
    const required = scope === "database" ? databaseKeys : serverKeys;

    return required.filter(key => !this.env[key]);
  }
}

export const appConfig = new AppConfig();
