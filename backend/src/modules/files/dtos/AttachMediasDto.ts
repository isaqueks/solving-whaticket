/**
 * Entrada de `FilesService.attachMedias` (upload de mídias da lista — endpoint
 * `/files/uploadList/:fileListId`).
 *
 * `optionIds`/`mediaTypes` chegam do body como escalar (um arquivo) ou array
 * (vários), pareados por índice com `files`; o service normaliza. Preserva o
 * contrato original do handler `uploadMedias`.
 */
export interface AttachMediasDto {
  fileId: string | number;
  optionIds: string | number | Array<string | number>;
  mediaTypes: string | string[];
  files: Express.Multer.File[];
  companyId: number;
}
