import { BaseApi } from "./BaseApi";

export class FilesApi extends BaseApi {
  list(params) {
    return this.http.request({
      url: "/files/",
      method: "GET",
      params
    });
  }

  remove(id) {
    return this.http.request({
      url: `/files/${id}`,
      method: "DELETE"
    });
  }
}

export const filesApi = new FilesApi();
