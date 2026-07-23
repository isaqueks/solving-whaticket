import { BaseApi } from "./BaseApi";

export class QueueIntegrationsApi extends BaseApi {
  list(params) {
    return this.http.request({
      url: "/queueIntegration/",
      method: "GET",
      params
    });
  }

  show(integrationId) {
    return this.http.get(`/queueIntegration/${integrationId}`);
  }

  store(data) {
    return this.http.post("/queueIntegration", data);
  }

  update(integrationId, data) {
    return this.http.put(`/queueIntegration/${integrationId}`, data);
  }

  testSession(data) {
    return this.http.post("/queueIntegration/testSession", data);
  }

  remove(id) {
    return this.http.request({
      url: `/queueIntegration/${id}`,
      method: "DELETE"
    });
  }
}

export const queueIntegrationsApi = new QueueIntegrationsApi();
