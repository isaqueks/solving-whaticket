import { cacheService } from "../shared/cache/CacheService";

/**
 * Re-export de compatibilidade (fase B0.4): a implementação vive em
 * `shared/cache/CacheService`. Os importadores de `cacheLayer` migram para
 * `cacheService` junto com seus módulos (fases B1–B6); depois este arquivo
 * será removido.
 */
export const cacheLayer = cacheService;
