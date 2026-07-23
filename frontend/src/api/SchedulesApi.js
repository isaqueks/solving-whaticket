import { BaseApi } from "./BaseApi";

export class SchedulesApi extends BaseApi {
  list(params) {
    return this.http.request({
      url: "/schedules/",
      method: "GET",
      params
    });
  }

  remove(id) {
    return this.http.request({
      url: `/schedules/${id}`,
      method: "DELETE"
    });
  }
}

export const schedulesApi = new SchedulesApi();
