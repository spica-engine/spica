import {Inject, Injectable} from "@nestjs/common";
import got, {Headers, Method} from "got";

@Injectable()
export class Request {
  reject: boolean = false;

  constructor(@Inject("SOCKET") readonly socket: string) {}

  options<T>(path: string) {
    return this.request<T>({method: "OPTIONS", path});
  }

  get<T>(path: string, query?: any, headers?: Headers) {
    return this.request<T>({method: "GET", path, query, headers});
  }

  delete<T>(path: string, body?: object, headers?: Headers) {
    return this.request<T>({method: "DELETE", path, body, headers});
  }

  post<T>(path: string, body?: object, headers?: Headers) {
    return this.request<T>({method: "POST", path, body, headers});
  }

  put<T>(path: string, body?: object, headers?: Headers) {
    return this.request<T>({method: "PUT", path, body, headers});
  }

  patch<T>(path: string, body?: object, headers?: Headers) {
    return this.request<T>({method: "PATCH", path, body, headers});
  }

  request<T>(options: RequestOptions): Promise<Response<T>> {
    const req: any = {
      headers: options.headers,
      method: options.method,
      socketPath: this.socket,
      pathname: options.path,
      hostname: "unix",
      protocol: "http:",
      responseType: "text"
    };

    if (options.query) {
      req.searchParams = options.query;
    }
    if (options.body instanceof Buffer) {
      req.body = options.body;
    } else {
      req.json = options.body;
    }

    return got(req)
      .then(r => {
        if (r && typeof r.body == "string" && r.body) {
          try {
            r.body = JSON.parse(r.body);
          } catch (e) {
            console.error(e);
          }
        }
        return {
          headers: r.headers as any,
          body: r.body,
          statusCode: r.statusCode,
          statusText: r.statusMessage
        };
      })
      .catch(error => {
        let {response} = error;
        response = {
          headers: response.headers as any,
          body: response.body,
          statusCode: response.statusCode,
          statusText: response.statusMessage
        };
        if (this.reject) {
          return Promise.reject(response);
        }
        return response;
      });

    // return request(req).catch(e => {
    //   const {response} = e;
    //   console.log(e);
    //   if (response && typeof response.body == "string") {
    //     try {
    //       response.body = JSON.parse(response.body);
    //     } catch (e) {
    //       console.error(e);
    //     }
    //   }

    //   if (this.reject) {
    //     return Promise.reject(response);
    //   }
    //   return response;
    // });
  }
}

export interface RequestOptions {
  method: Method;
  path: string;
  body?: any;
  query?: object;
  headers?: Headers;
}

export interface Response<T = any> {
  headers: {
    [header: string]: string;
  };
  body: any;
  statusCode: number;
  statusText: string;
}
