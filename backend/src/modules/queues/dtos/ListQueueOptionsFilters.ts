/**
 * Filtros da listagem de opções de fila. `parentId` preserva a semântica
 * original do ListService legado: -1 significa "somente nós raiz"
 * (parentId nulo); > 0 filtra pelos filhos daquele pai.
 */
export interface ListQueueOptionsFilters {
  queueId: string | number;
  queueOptionId: string | number;
  parentId: string | number | boolean;
}
