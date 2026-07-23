/**
 * Item de uma lista de arquivos vindo do frontend (opção da lista). `id`
 * presente = opção existente (upsert atualiza); ausente = nova. `path`/
 * `mediaType` só chegam preenchidos depois do upload da mídia — na criação/
 * edição da lista vêm vazios (comportamento original de Create/UpdateService).
 */
export interface FileOptionInput {
  id?: number;
  name: string;
  path?: string;
  mediaType?: string;
}
