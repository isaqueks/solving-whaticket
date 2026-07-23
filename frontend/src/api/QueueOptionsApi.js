import { BaseApi } from "./BaseApi";

/**
 * Endpoints dos nós do chatbot da fila (`/queue-options`). No backend vivem no
 * mesmo módulo de Queues (modules/queues), mas são um sub-recurso próprio — daí
 * uma classe dedicada no frontend. URLs idênticas às antigas chamadas inline do
 * componente QueueOptions.
 */
export class QueueOptionsApi extends BaseApi {
  list(params) {
    return this.http.request({
      url: "/queue-options",
      method: "GET",
      params
    });
  }

  store(data) {
    return this.http.request({
      url: "/queue-options",
      method: "POST",
      data
    });
  }

  update(id, data) {
    return this.http.request({
      url: `/queue-options/${id}`,
      method: "PUT",
      data
    });
  }

  remove(id) {
    return this.http.request({
      url: `/queue-options/${id}`,
      method: "DELETE"
    });
  }

  mediaUpload(id, formData) {
    return this.http.post(`/queue-options/${id}/media-upload`, formData);
  }
}

export const queueOptionsApi = new QueueOptionsApi();
