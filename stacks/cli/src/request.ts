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
    return fetch(url, options).then(r =>
      r.json().catch(e => {
        if (e.type == "invalid-json") {
          return Promise.resolve(r);
        }
        return Promise.reject(e);
      })
    );
  }

  export async function post<T>(url: string, body?: object, headers?: HeaderInit): Promise<T> {
    headers = headers || {};
    headers["Content-type"] = "application/json";
    const options: RequestInit = {
      method: "POST",
      body: JSON.stringify(body),
      headers: headers
    };
    return fetch(url, options).then(r =>
      r.json().catch(e => {
        if (e.type == "invalid-json") {
          return Promise.resolve(r);
        }
        return Promise.reject(e);
      })
    );
  }

  export async function del<T>(url: string, headers?: HeaderInit): Promise<T> {
    headers = headers || {};
    headers["Content-type"] = "application/json";
    const options: RequestInit = {
      method: "DELETE",
      headers: headers
    };
    return fetch(url, options).then(r =>
      r.json().catch(e => {
        if (e.type == "invalid-json") {
          return Promise.resolve(r);
        }
        return Promise.reject(e);
      })
    );
  }
}
