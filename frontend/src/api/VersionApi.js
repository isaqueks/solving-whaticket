import { BaseApi } from "./BaseApi";

export class VersionApi extends BaseApi {
  getVersion() {
    return this.http.request({
      url: "/version",
      method: "GET"
    });
  }
}

export const versionApi = new VersionApi();
