import { BaseApi } from "./BaseApi";

export class DashboardApi extends BaseApi {
  find(params) {
    return this.http.request({
      url: "/dashboard",
      method: "GET",
      params
    });
  }
}

export const dashboardApi = new DashboardApi();
