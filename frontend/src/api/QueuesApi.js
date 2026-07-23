import { BaseApi } from "./BaseApi";

export class QueuesApi extends BaseApi {
  findAll(params) {
    return this.http.get("/queue", { params });
  }

  show(queueId) {
    return this.http.get(`/queue/${queueId}`);
  }

  store(data) {
    return this.http.post("/queue", data);
  }

  update(queueId, data) {
    return this.http.put(`/queue/${queueId}`, data);
  }

  mediaUpload(queueId, formData) {
    return this.http.post(`/queue/${queueId}/media-upload`, formData);
  }

  deleteMedia(queueId) {
    return this.http.delete(`/queue/${queueId}/media-upload`);
  }

  remove(id) {
    return this.http.request({
      url: `/queue/${id}`,
      method: "DELETE"
    });
  }
}

export const queuesApi = new QueuesApi();
