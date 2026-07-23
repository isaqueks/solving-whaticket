import User from "../models/User";

/** Entrada de `UsersService.list` (doc 04 §4). */
export interface ListUsersFilters {
  searchParam?: string;
  pageNumber?: string | number;
  profile?: string;
  companyId?: number;
}

/** Saída de `UsersService.list`. */
export interface ListUsersResult {
  users: User[];
  count: number;
  hasMore: boolean;
}
