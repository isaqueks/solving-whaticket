import { BaseApi } from "./BaseApi";

export class CampaignsApi extends BaseApi {
  list(params) {
    return this.http.request({
      url: "/campaigns/",
      method: "GET",
      params
    });
  }

  show(id) {
    return this.http.request({
      url: `/campaigns/${id}`,
      method: "GET"
    });
  }

  store(data) {
    return this.http.request({
      url: "/campaigns",
      method: "POST",
      data
    });
  }

  update(id, data) {
    return this.http.request({
      url: `/campaigns/${id}`,
      method: "PUT",
      data
    });
  }

  mediaUpload(id, formData) {
    return this.http.request({
      url: `/campaigns/${id}/media-upload`,
      method: "POST",
      data: formData
    });
  }

  deleteMedia(id) {
    return this.http.request({
      url: `/campaigns/${id}/media-upload`,
      method: "DELETE"
    });
  }

  remove(id) {
    return this.http.request({
      url: `/campaigns/${id}`,
      method: "DELETE"
    });
  }

  cancel(id) {
    return this.http.request({
      url: `/campaigns/${id}/cancel`,
      method: "POST"
    });
  }

  restart(id) {
    return this.http.request({
      url: `/campaigns/${id}/restart`,
      method: "POST"
    });
  }
}

export const campaignsApi = new CampaignsApi();
