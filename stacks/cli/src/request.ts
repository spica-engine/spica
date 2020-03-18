import fetch, {HeaderInit, RequestInit} from "node-fetch";

export namespace request {
  export namespace stream {
    export function post({
      url,
      body,
      headers
    }: {
      url: string;
      body: object;
      headers?: HeaderInit;
    }): Promise<NodeJS.ReadableStream> {
      headers = headers || {};
      headers["Content-type"] = "application/json";
      const options: RequestInit = {
        method: "POST",
        body: JSON.stringify(body),
        headers
      };
      return fetch(url, options).then(r => r.body);
    }
  }

  export function get<T>(url: string, headers?: HeaderInit): Promise<T> {
    headers = headers || {};
    headers["Content-type"] = "application/json";
    const options: RequestInit = {
      method: "GET",
      headers: headers
    };
    return fetch(url, options).then(r => {
      if (r.status != 201) {
        return r.json();
      }
      return r;
    });
  }

  export async function post<T>(url: string, body?: object, headers?: HeaderInit): Promise<T> {
    headers = headers || {};
    headers["Content-type"] = "application/json";
    const options: RequestInit = {
      method: "POST",
      body: JSON.stringify(body),
      headers: headers
    };
    return fetch(url, options).then(r => {
      if (r.status != 201) {
        return r.json();
      }
      return r;
    });
  }

  export async function del<T>(url: string, headers?: HeaderInit): Promise<T> {
    headers = headers || {};
    headers["Content-type"] = "application/json";
    const options: RequestInit = {
      method: "DELETE",
      headers: headers
    };
    return fetch(url, options).then(r => {
      if (r.status != 201 && r.status != 204) {
        return r.json();
      }
      return r;
    });
  }
}
