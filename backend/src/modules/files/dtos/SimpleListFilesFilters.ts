/**
 * Entrada de `FilesService.simpleList` (lista plana por empresa, sem paginação
 * — endpoint `/files/list`, comportamento original do SimpleListService).
 */
export interface SimpleListFilesFilters {
  companyId: number;
  searchParam?: string;
}
