import { BaseApi } from "./BaseApi";

export class QuickMessagesApi extends BaseApi {
  save(data) {
    return this.http.request({
      url: "/quick-messages",
      method: "POST",
      data
    });
  }

  update(data) {
    return this.http.request({
      url: `/quick-messages/${data.id}`,
      method: "PUT",
      data
    });
  }

  remove(id) {
    return this.http.request({
      url: `/quick-messages/${id}`,
      method: "DELETE"
    });
  }

  list(params) {
    return this.http.request({
      url: "/quick-messages/list",
      method: "GET",
      params
    });
  }

  index(params) {
    return this.http.request({
      url: "/quick-messages",
      method: "GET",
      params
    });
  }

  show(id) {
    return this.http.request({
      url: `/quick-messages/${id}`,
      method: "GET"
    });
  }

  mediaUpload(id, formData) {
    return this.http.request({
      url: `/quick-messages/${id}/media-upload`,
      method: "POST",
      data: formData
    });
  }

  deleteMedia(id) {
    return this.http.request({
      url: `/quick-messages/${id}/media-upload`,
      method: "DELETE"
    });
  }
}

export const quickMessagesApi = new QuickMessagesApi();
