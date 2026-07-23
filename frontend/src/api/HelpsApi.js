import { BaseApi } from "./BaseApi";

export class HelpsApi extends BaseApi {
  findAll(params) {
    return this.http.request({
      url: "/helps",
      method: "GET",
      params
    });
  }

  list(params) {
    return this.http.request({
      url: "/helps/list",
      method: "GET",
      params
    });
  }

  save(data) {
    return this.http.request({
      url: "/helps",
      method: "POST",
      data
    });
  }

  update(data) {
    return this.http.request({
      url: `/helps/${data.id}`,
      method: "PUT",
      data
    });
  }

  remove(id) {
    return this.http.request({
      url: `/helps/${id}`,
      method: "DELETE"
    });
  }
}

export const helpsApi = new HelpsApi();
