import {Injectable} from "@nestjs/common";
import * as request from "request-promise";

@Injectable()
export class Request {
  get socket() {
    return `/tmp/${process.env.BAZEL_TARGET.replace(/\/|:/g, "_")}.sock`;
  }

  options<T>(path: string) {
    return this.request<T>({method: "OPTIONS", path});
  }

  get<T>(path: string, query: any) {
    return this.request<T>({method: "GET", path, qs: query});
  }

  post<T>(path: string, body?: object) {
    return this.request<T>({method: "POST", path, body});
  }

  put<T>(path: string, body?: object) {
    return this.request<T>({method: "PUT", path, body});
  }

  request<T>(options: RequestOptions): Promise<Response<T>> {
    return request({
      json: true,
      method: options.method,
      body: options.body,
      uri: `http://unix:${this.socket}:${options.path}`,
      transform: (body, response) => {
        return {
          headers: response.headers,
          body,
          statusCode: response.statusCode,
          statusText: response.statusMessage
        };
      }
    }).catch(e => {
      const {response} = e;
      if (typeof response.body == "string") {
        try {
          response.body = JSON.parse(response.body);
        } catch (e) {
          console.error(e);
        }
      }

      return response;
    });
  }
}

export interface RequestOptions {
  method: string;
  path: string;
  body?: any;
  qs?: object;
}

export interface Response<T = any> {
  headers: {
    [header: string]: string;
  };
  body: any;
  statusCode: number;
  statusText: string;
}
