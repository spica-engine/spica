import {Inject, Injectable} from "@nestjs/common";
import got, {Headers, Method} from "got";
import * as querystring from "querystring";

@Injectable()
export class Request {
  reject: boolean = false;
  debug: boolean = false;

  headers: Headers = {};

  setDefaultHeaders(headers: Headers) {
    this.headers = headers;
  }

  constructor(@Inject("SOCKET") readonly socket: string) {}

  options<T>(path: string, headers?: Headers) {
    return this.request<T>({method: "OPTIONS", path, headers});
  }

  get<T>(path: string, query?: any, headers?: Headers) {
    return this.request<T>({method: "GET", path, query, headers});
  }

  delete<T>(path: string, body?: object, headers?: Headers) {
    return this.request<T>({method: "DELETE", path, body, headers});
  }

  post<T>(path: string, body?: any, headers?: Headers, query?: any) {
    return this.request<T>({method: "POST", path, body, headers, query});
  }

  put<T>(path: string, body?: object, headers?: Headers) {
    return this.request<T>({method: "PUT", path, body, headers});
  }

  patch<T>(path: string, body?: object, headers?: Headers) {
    return this.request<T>({method: "PATCH", path, body, headers});
  }

  request<T>(options: RequestOptions): Promise<Response<T>> {
    const req: any = {
      headers: options.headers ? {...this.headers, ...options.headers} : this.headers,
      method: options.method,
      socketPath: this.socket,
      pathname: options.path,
      hostname: "unix",
      protocol: "http:",
      responseType: "text"
    };

    if (options.followRedirect != undefined) {
      req.followRedirect = options.followRedirect;
    }

    if (options.query) {
      req.search = querystring.stringify(options.query);
    }
    if (options.body instanceof Buffer) {
      req.body = options.body;
    } else {
      req.json = options.body;
    }

    return got(req)
      .then(response => {
        if (response && typeof response.body == "string" && response.body) {
          try {
            response.body = JSON.parse(response.body);
          } catch (e) {
            /application\/json/.test(response.headers["content-type"]) && console.error(e);
          }
        }
        return {
          headers: response.headers as any,
          body: response.body ? response.body : undefined,
          statusCode: response.statusCode,
          statusText: response.statusMessage
        };
      })
      .catch(error => {
        let {response} = error;
        if (!response) {
          return Promise.reject(error);
        }
        if (response && typeof response.body == "string" && response.body) {
          try {
            response.body = JSON.parse(response.body);
          } catch (e) {
            /application\/json/.test(response.headers["content-type"]) && console.error(e);
          }
        }
        response = {
          headers: response.headers as any,
          body: response.body ? response.body : undefined,
          statusCode: response.statusCode,
          statusText: response.statusMessage,
          toString() {
            return JSON.stringify({...this, path: options.path});
          }
        };
        if (this.reject) {
          return Promise.reject(response);
        }
        return response;
      });
  }
}

export interface RequestOptions {
  method: Method;
  path: string;
  body?: any;
  query?: any;
  headers?: Headers;
  followRedirect?: boolean;
}

export interface Response<T = any> {
  headers: {
    [header: string]: string;
  };
  body: any;
  statusCode: number;
  statusText: string;
}
