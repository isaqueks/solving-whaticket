import { BaseApi } from "./BaseApi";

export class UsersApi extends BaseApi {
  list(params) {
    return this.http.get("/users", { params });
  }

  /** GET /users/list — lista simplificada (id/name) para filtros. */
  listAll() {
    return this.http.get("/users/list");
  }

  remove(id) {
    return this.http.request({
      url: `/users/${id}`,
      method: "DELETE"
    });
  }
}

export const usersApi = new UsersApi();
