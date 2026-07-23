import fs from "fs";
import path from "path";

import AppError from "../errors/AppError";

/**
 * Armazenamento de mídia compartilhado (doc 04 §10).
 *
 * Unifica as cópias quase-idênticas de `mediaUpload`/`deleteMedia` espalhadas
 * hoje por 6 controllers (QuickMessage, Campaign, Schedule, Queue,
 * QueueOption, Announcement). Nesta fase (B2) apenas o módulo QuickMessages a
 * consome; os outros 5 passam a usá-la conforme migrarem.
 *
 * A ESCRITA em disco continua a cargo do multer (`config/upload.ts`), que roda
 * antes do handler — `saveUpload` só valida e devolve o nome já persistido. A
 * atualização do model (mediaPath/mediaName) permanece no service de cada
 * domínio, por isso esta classe não conhece nenhum model.
 *
 * DRIFT conhecido entre as 6 cópias — a EXCLUSÃO diverge:
 *  - Campaign/Schedule/Queue/QueueOption/Announcement apagam por `mediaPath` na
 *    raiz de `public/` → `public/<mediaPath>`.
 *  - QuickMessage apaga por `mediaName` dentro da subpasta `quickMessage/` →
 *    `public/quickMessage/<mediaName>`.
 * Por isso `deleteFile` recebe o caminho RELATIVO já montado pelo chamador:
 * cada domínio preserva a sua convenção até a unificação final da drift.
 */
export class MediaStorageService {
  /**
   * Devolve o nome do arquivo já gravado em disco pelo multer.
   *
   * `companyId` faz parte da assinatura para armazenamento com escopo de
   * empresa no futuro; hoje o comportamento é idêntico ao legado
   * (retorna `file.filename`).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public saveUpload(file: Express.Multer.File, companyId: number): string {
    if (!file) {
      throw new AppError("ERR_UPLOAD_NO_FILE");
    }

    return file.filename;
  }

  /**
   * Remove um arquivo relativo a `public/`, se existir. Idempotente: ausência
   * do arquivo não é erro (comportamento original dos 6 controllers).
   */
  public deleteFile(relativePath: string): void {
    const filePath = path.resolve("public", relativePath);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
