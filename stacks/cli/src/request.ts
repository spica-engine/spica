import * as req from "request-promise-native";

export namespace request {
  export function get<T>(url: string, headers?: object): Promise<T> {
    const requestOptions = {
      method: "GET",
      uri: url,
      json: true,
      headers: headers
    };
    return Promise.resolve(req(requestOptions));
  }

  export async function post<T>(url: string, body?: object, headers?: object): Promise<T> {
    const requestOptions = {
      method: "POST",
      uri: url,
      json: true,
      body: body,
      headers: headers
    };
    return Promise.resolve(req(requestOptions));
  }

  export async function del<T>(url: string, headers?: object): Promise<T> {
    const requestOptions = {
      method: "DELETE",
      uri: url,
      json: true,
      headers: headers
    };
    return Promise.resolve(req(requestOptions));
  }
}
