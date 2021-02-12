import fetch, {Response} from "node-fetch";
import axios, {AxiosRequestConfig, AxiosInstance, AxiosResponse} from "axios";

interface RequestInit {
  body?: BodyInit;
  headers?: HeadersInit;
}

export class HttpService {
  private instance: AxiosInstance;

  private readonly interceptors = {
    request: {
      onFulfilled: (request: AxiosRequestConfig) => {
        if (!request.headers["Authorization"]) {
          throw new Error(
            "You should call initialize method with a valid apikey or identity token."
          );
        }
        return request;
      },
      onRejected: (error: any) => {
        return Promise.reject(error);
      }
    },
    response: {
      onFulfilled: (response: AxiosResponse) => {
        const warning = response.headers["warning"];
        if (warning) {
          console.warn(warning);
        }
        return response.data;
      },
      onRejected: (error: any) => {
        return Promise.reject(error.response ? error.response.data : error);
      }
    }
  };

  constructor(
    config: AxiosRequestConfig,
    writeDefaults?: {
      headers: {[key: string]: string};
    }
  ) {
    this.instance = axios.create(config);

    this.instance.interceptors.request.use(
      this.interceptors.request.onFulfilled,
      this.interceptors.request.onRejected
    );
    this.instance.interceptors.response.use(
      this.interceptors.response.onFulfilled,
      this.interceptors.response.onRejected
    );

    if (writeDefaults && writeDefaults.headers && Object.keys(writeDefaults.headers).length) {
      for (const [header, value] of Object.entries(writeDefaults.headers)) {
        this.instance.defaults.headers.post[header] = value;
        this.instance.defaults.headers.put[header] = value;
      }
    }
  }

  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.get(url, config);
  }

  post<T>(url: string, body: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.post(url, body, config);
  }

  put<T>(url: string, body: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.put(url, body, config);
  }

  patch<T>(url: string, body: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.patch(url, body, config);
  }

  delete(url: string, config?: AxiosRequestConfig): Promise<any> {
    return this.instance.delete(url, config);
  }
}

export namespace http {
  export function get<T>(url: string | URL, requestInfo: RequestInit = {}, parser?: Parser) {
    const method = "get";
    return send(url, method, requestInfo).then(response => finalizeResponse<T>(response, parser));
  }

  export function put<T>(url: string | URL, requestInfo: RequestInit = {}) {
    const method = "put";
    return send(url, method, requestInfo).then(response => finalizeResponse<T>(response));
  }

  export function post<T>(url: string | URL, requestInfo: RequestInit = {}) {
    const method = "post";
    return send(url, method, requestInfo).then(response => finalizeResponse<T>(response));
  }

  export function patch<T>(url: string | URL, requestInfo: RequestInit = {}) {
    const method = "patch";
    return send(url, method, requestInfo).then(response => finalizeResponse<T>(response));
  }

  export function del(url: string | URL, requestInfo: RequestInit = {}) {
    const method = "delete";
    return send(url, method, requestInfo).then(response => finalizeResponse<any>(response));
  }
}

function send(url: string | URL, method: string, requestInfo: RequestInit) {
  const request: any = {
    ...requestInfo,
    method: method
  };

  return fetch(url, request);
}

function finalizeResponse<T>(response: Response, parser: Parser = Parser.Json): Promise<T> {
  logWarning(response);

  // parsing response that has 204 status is not possible
  if (response.status == 204) {
    return Promise.resolve(undefined);
  }

  if (parser == Parser.Json) {
    return response.json().then(body => {
      if (!response.ok) {
        throw new Error(JSON.stringify(body));
      }
      return body as T;
    });
  } else if (parser == Parser.Blob) {
    return response.blob() as Promise<any>;
  }
}

function logWarning(response: Response) {
  const warning = response.headers.get("warning");
  if (warning) {
    console.warn(warning);
  }
}

export enum Parser {
  Json,
  Blob
}
