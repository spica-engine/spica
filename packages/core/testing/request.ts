import {Injectable} from "@nestjs/common";
import * as request from "request-promise-native";

@Injectable()
export class Request {
  get socket() {
    return `/tmp/${process.env.BAZEL_TARGET.replace(/\/|:/g, "_")}.sock`;
  }

  options<T>(path: string) {
    return this.request<T>({method: "OPTIONS", path});
  }

  get<T>(path: string, query: any, headers?: object) {
    return this.request<T>({method: "GET", path, qs: query, headers});
  }

  delete<T>(path: string) {
    return this.request<T>({method: "DELETE", path});
  }

  post<T>(path: string, body?: object, headers?: object) {
    return this.request<T>({method: "POST", path, body, headers});
  }

  put<T>(path: string, body?: object, headers?: object) {
    return this.request<T>({method: "PUT", path, body, headers});
  }

  request<T>(options: RequestOptions): Promise<Response<T>> {
    const req: any = {
      headers: options.headers,
      method: options.method,
      body: options.body,
      uri: `http://unix:${this.socket}:${options.path}`,
      qs: options.qs,
      transform: (body, response) => {
        return {
          headers: response.headers,
          body,
          statusCode: response.statusCode,
          statusText: response.statusMessage
        };
      }
    };

    if (options.body instanceof Buffer) {
      req.encoding = null;
    } else {
      req.json = true;
    }

    return request(req).catch(e => {
      const {response} = e;
      if (response && typeof response.body == "string") {
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
  headers?: object;
}

export interface Response<T = any> {
  headers: {
    [header: string]: string;
  };
  body: any;
  statusCode: number;
  statusText: string;
}
