import * as crypto from "crypto";
import Redis from "ioredis";

import { appConfig } from "../../config/AppConfig";

/**
 * Camada de cache sobre Redis — mesma API do antigo `libs/cache.ts`
 * (`cacheLayer`), agora como classe (fase B0.4). `libs/cache.ts` permanece
 * como re-export fino do singleton até os importadores migrarem por módulo.
 *
 * Assinaturas preservadas do original. `params` (chave de cache serializada via
 * JSON) endurecido para `unknown` na B7; restam só os casts de `option` (overload
 * do ioredis para `SET ... EX/PX`).
 */
export class CacheService {
  constructor(
    private readonly redis: Redis = new Redis(appConfig.redis.uri)
  ) {}

  public set(
    key: string,
    value: string,
    option?: string,
    optionValue?: string | number
  ): Promise<string> {
    if (option !== undefined && optionValue !== undefined) {
      return this.redis.set(key, value, option as any, optionValue as any);
    }

    return this.redis.set(key, value);
  }

  public get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  public getKeys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  public del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  public async delFromPattern(pattern: string): Promise<void> {
    const all = await this.getKeys(pattern);

    for (const item of all) {
      await this.del(item);
    }
  }

  public setFromParams(
    key: string,
    params: unknown,
    value: string,
    option?: string,
    optionValue?: string | number
  ): Promise<string> {
    return this.set(this.buildKey(key, params), value, option, optionValue);
  }

  public getFromParams(key: string, params: unknown): Promise<string | null> {
    return this.get(this.buildKey(key, params));
  }

  public delFromParams(key: string, params: unknown): Promise<number> {
    return this.del(this.buildKey(key, params));
  }

  private buildKey(key: string, params: unknown): string {
    return `${key}:${this.encryptParams(params)}`;
  }

  private encryptParams(params: unknown): string {
    const str = JSON.stringify(params);
    return crypto.createHash("sha256").update(str).digest("base64");
  }
}

export const cacheService = new CacheService();
