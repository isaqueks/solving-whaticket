import { BaseApi } from "./BaseApi";

export class AnnouncementsApi extends BaseApi {
  list(params) {
    return this.http.request({
      url: "/announcements/",
      method: "GET",
      params
    });
  }

  remove(id) {
    return this.http.request({
      url: `/announcements/${id}`,
      method: "DELETE"
    });
  }

  deleteMedia(id) {
    return this.http.request({
      url: `/announcements/${id}/media-upload`,
      method: "DELETE"
    });
  }
}

export const announcementsApi = new AnnouncementsApi();
