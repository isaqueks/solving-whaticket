import { FileOptionInput } from "./FileOptionInput";

/**
 * Entrada de `FilesService.update` (doc 04 §4). Campos opcionais: o service
 * aplica os presentes. `options` presente = reconciliação da lista (upsert dos
 * enviados + destroy dos removidos), comportamento original do UpdateService.
 */
export interface UpdateFileListDto {
  id?: number;
  name?: string;
  message?: string;
  options?: FileOptionInput[];
}
