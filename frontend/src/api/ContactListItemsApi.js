import { BaseApi } from "./BaseApi";

export class ContactListItemsApi extends BaseApi {
  list(params) {
    return this.http.request({
      url: "/contact-list-items",
      method: "GET",
      params
    });
  }

  remove(id) {
    return this.http.request({
      url: `/contact-list-items/${id}`,
      method: "DELETE"
    });
  }
}

export const contactListItemsApi = new ContactListItemsApi();
