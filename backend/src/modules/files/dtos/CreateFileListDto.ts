import { FileOptionInput } from "./FileOptionInput";

/**
 * Entrada de `FilesService.create` (doc 04 §4). `options` é a lista de itens
 * da lista de arquivos (upsert em FilesOptions), opcional na criação.
 */
export interface CreateFileListDto {
  name: string;
  message: string;
  companyId: number;
  options?: FileOptionInput[];
}
