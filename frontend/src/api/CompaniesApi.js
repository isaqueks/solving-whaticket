import { BaseApi } from "./BaseApi";

export class CompaniesApi extends BaseApi {
  save(data) {
    return this.http.request({
      url: "/companies",
      method: "POST",
      data
    });
  }

  findAll() {
    return this.http.request({
      url: "/companies",
      method: "GET"
    });
  }

  list() {
    return this.http.request({
      url: "/companies/list",
      method: "GET"
    });
  }

  find(id) {
    return this.http.request({
      url: `/companies/${id}`,
      method: "GET"
    });
  }

  update(data) {
    return this.http.request({
      url: `/companies/${data.id}`,
      method: "PUT",
      data
    });
  }

  remove(id) {
    return this.http.request({
      url: `/companies/${id}`,
      method: "DELETE"
    });
  }

  updateSchedules(data) {
    return this.http.request({
      url: `/companies/${data.id}/schedules`,
      method: "PUT",
      data
    });
  }
}

export const companiesApi = new CompaniesApi();
