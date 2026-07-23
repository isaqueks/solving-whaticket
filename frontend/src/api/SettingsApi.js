import { BaseApi } from "./BaseApi";

export class SettingsApi extends BaseApi {
  getAll(params) {
    return this.http.request({
      url: "/settings",
      method: "GET",
      params
    });
  }

  update(data) {
    return this.http.request({
      url: `/settings/${data.key}`,
      method: "PUT",
      data
    });
  }
}

export const settingsApi = new SettingsApi();
