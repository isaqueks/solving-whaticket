/**
 * Factory de reducer de coleção (doc 03, fase F1.1 / doc 04 §9, §10).
 *
 * Substitui os ~18 reducers LOAD/UPDATE/DELETE/RESET copiados página a página.
 * Reproduz a semântica comum EXATAMENTE e deixa o comportamento específico de
 * cada entidade nos handlers `extra`.
 *
 * Semântica comum capturada das cópias originais:
 *  - LOAD  → `upsertMany`: para cada item do payload, se o `id` já existe no
 *            estado, substitui no lugar; senão, acumula os novos e os
 *            acrescenta ao FINAL (`[...state, ...novos]`). Igual a Users,
 *            Contacts, Tags, Queues, Campaigns, etc.
 *  - UPDATE → `upsertOne`: acha por `id`; se existe, substitui no lugar; se
 *            não, PREPEND (`[item, ...state]`) — o padrão dominante das cópias.
 *  - DELETE → filtra por `id` (equivalente ao `findIndex`+`splice` original).
 *  - RESET  → `[]`.
 *
 * Variações reais suportadas por opção (não são "abstração à força", são as
 * cópias que já divergiam):
 *  - `loadStrategy`: "merge" (padrão) | "append" (Schedules: `[...state,
 *    ...payload]` sem dedup) | "replace" (useWhatsApps: `[...payload]`).
 *  - `updateOnMissing`: "prepend" (padrão) | "append" | "ignore".
 *
 * Os action.type variam por entidade (`LOAD_USERS`, `UPDATE_TAGS`…); o mapa é
 * passado na config para que os `dispatch(...)` das páginas fiquem INALTERADOS.
 * Ações one-off (`ADD_MESSAGE`, `CHANGE_CHAT`, `UPDATE_SESSION`…) entram por
 * `extra` — um mapa `{ [action.type]: (state, action) => nextState }`.
 *
 * @param {object}   config
 * @param {string}   [config.load]            action.type do LOAD (upsert-many).
 * @param {string}   [config.update]          action.type do UPDATE (upsert-one).
 * @param {string}   [config.remove]          action.type do DELETE (por id).
 * @param {string}   [config.reset="RESET"]   action.type do RESET (→ []).
 * @param {string}   [config.idKey="id"]      chave de identidade.
 * @param {"merge"|"append"|"replace"} [config.loadStrategy="merge"]
 * @param {"prepend"|"append"|"ignore"} [config.updateOnMissing="prepend"]
 * @param {Record<string,(state:any[],action:any)=>any[]>} [config.extra]
 * @returns {(state:any[], action:{type:string,payload:any}) => any[]}
 */
export const createEntityReducer = ({
  load,
  update,
  remove,
  reset = "RESET",
  idKey = "id",
  loadStrategy = "merge",
  updateOnMissing = "prepend",
  extra = {},
} = {}) => {
  return (state, action) => {
    const { type } = action;

    if (load && type === load) {
      return upsertMany(state, action.payload, { idKey, loadStrategy });
    }

    if (update && type === update) {
      return upsertOne(state, action.payload, { idKey, updateOnMissing });
    }

    if (remove && type === remove) {
      return state.filter((item) => item[idKey] !== action.payload);
    }

    if (reset && type === reset) {
      return [];
    }

    const handler = extra[type];
    if (handler) {
      return handler(state, action);
    }

    return state;
  };
};

const upsertMany = (state, payload, { idKey, loadStrategy }) => {
  const incoming = Array.isArray(payload) ? payload : [];

  if (loadStrategy === "replace") {
    return [...incoming];
  }

  if (loadStrategy === "append") {
    return [...state, ...incoming];
  }

  // merge (padrão): substitui no lugar quem já existe, acrescenta o resto.
  const next = [...state];
  const additions = [];

  incoming.forEach((item) => {
    const index = next.findIndex((entity) => entity[idKey] === item[idKey]);
    if (index !== -1) {
      next[index] = item;
    } else {
      additions.push(item);
    }
  });

  return [...next, ...additions];
};

const upsertOne = (state, item, { idKey, updateOnMissing }) => {
  const index = state.findIndex((entity) => entity[idKey] === item[idKey]);

  if (index !== -1) {
    const next = [...state];
    next[index] = item;
    return next;
  }

  if (updateOnMissing === "append") {
    return [...state, item];
  }

  if (updateOnMissing === "ignore") {
    return [...state];
  }

  return [item, ...state];
};
