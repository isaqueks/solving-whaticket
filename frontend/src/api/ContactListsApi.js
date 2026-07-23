import { BaseApi } from "./BaseApi";

export class ContactListsApi extends BaseApi {
  save(data) {
    return this.http.request({
      url: "/contact-lists",
      method: "POST",
      data
    });
  }

  update(data) {
    return this.http.request({
      url: `/contact-lists/${data.id}`,
      method: "PUT",
      data
    });
  }

  remove(id) {
    return this.http.request({
      url: `/contact-lists/${id}`,
      method: "DELETE"
    });
  }

  findById(id) {
    return this.http.request({
      url: `/contact-lists/${id}`,
      method: "GET"
    });
  }

  list(params) {
    return this.http.request({
      url: "/contact-lists/list",
      method: "GET",
      params
    });
  }

  findAll(params) {
    return this.http.request({
      url: "/contact-lists/",
      method: "GET",
      params
    });
  }

  upload(id, formData) {
    return this.http.request({
      url: `/contact-lists/${id}/upload`,
      method: "POST",
      data: formData
    });
  }
}

export const contactListsApi = new ContactListsApi();
