/** Referência mínima de tag enviada pelo frontend (TagsContainer). */
export interface TagReference {
  id: number;
}

/** Entrada de `TagsService.syncTags`: substitui as tags de um ticket. */
export interface SyncTagsDto {
  ticketId: number;
  tags: TagReference[];
}
