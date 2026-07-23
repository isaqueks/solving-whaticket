import { BaseApi } from "./BaseApi";

export class TagsApi extends BaseApi {
  list(params) {
    return this.http.request({
      url: "/tags/",
      method: "GET",
      params
    });
  }

  /** GET /tags/list — lista simplificada (id/name/color) para filtros. */
  listAll() {
    return this.http.get("/tags/list");
  }

  remove(id) {
    return this.http.request({
      url: `/tags/${id}`,
      method: "DELETE"
    });
  }
}

export const tagsApi = new TagsApi();
