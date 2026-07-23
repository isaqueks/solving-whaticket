import { BaseApi } from "./BaseApi";

export class ChatsApi extends BaseApi {
  list(params) {
    return this.http.request({
      url: "/chats/",
      method: "GET",
      params
    });
  }
}

export const chatsApi = new ChatsApi();
