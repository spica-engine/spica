import axios, {AxiosRequestConfig, AxiosInstance, AxiosResponse} from "axios";
import {HttpService, InterceptorIds, InterceptorDef} from "./interface";

export function logWarning(response: any) {
  const warning = response.headers["warning"];
  if (warning) {
    console.warn(warning);
  }
}

export class Axios implements HttpService {
  private instance: AxiosInstance;
  baseUrl: string;

  private readonly defaultInterceptors = {
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
        logWarning(response);
        return response.data;
      },
      onRejected: (error: any) => {
        return Promise.reject(error.response ? error.response.data : error);
      }
    }
  };

  private defaultInterceptorIds: InterceptorIds = {};

  constructor(config: AxiosRequestConfig) {
    this.instance = axios.create(config);

    this.defaultInterceptorIds.request = this.instance.interceptors.request.use(
      this.defaultInterceptors.request.onFulfilled,
      this.defaultInterceptors.request.onRejected
    );

    this.defaultInterceptorIds.response = this.instance.interceptors.response.use(
      this.defaultInterceptors.response.onFulfilled,
      this.defaultInterceptors.response.onRejected
    );

    this.baseUrl = this.instance.defaults.baseURL;
  }

  attachInterceptor(
    interceptor: InterceptorDef<AxiosRequestConfig, AxiosResponse>
  ): InterceptorIds {
    // to keep the default interceptor at the last index
    this.ejectInterceptor(this.defaultInterceptorIds);
    const interceptorIds = this.useInterceptor(interceptor);
    this.useInterceptor(this.defaultInterceptors);

    return interceptorIds;
  }

  // in case we want to write custom logic here just like we do for attachInterceptor
  detachInterceptor(interceptorIds: InterceptorIds): void {
    this.ejectInterceptor(interceptorIds);
  }

  private useInterceptor(interceptor: InterceptorDef<AxiosRequestConfig, AxiosResponse>) {
    const interceptorIds: InterceptorIds = {};

    if (interceptor.request) {
      interceptorIds.request = this.instance.interceptors.request.use(
        interceptor.request.onFulfilled,
        interceptor.request.onRejected
      );
    }

    if (interceptor.response) {
      interceptorIds.response = this.instance.interceptors.response.use(
        interceptor.response.onFulfilled,
        interceptor.response.onRejected
      );
    }

    return interceptorIds;
  }

  private ejectInterceptor(interceptorIds: InterceptorIds) {
    if (interceptorIds.request) {
      this.instance.interceptors.request.eject(interceptorIds.request);
    }

    if (interceptorIds.response) {
      this.instance.interceptors.response.eject(interceptorIds.response);
    }
  }

  setBaseUrl(url: string) {
    this.instance.defaults.baseURL = url;
  }

  setWriteDefaults(writeDefaults: {headers: {[key: string]: string}}) {
    for (const [header, value] of Object.entries(writeDefaults.headers)) {
      this.instance.defaults.headers.post[header] = value;
      this.instance.defaults.headers.put[header] = value;
    }
  }

  setAuthorization(authorization: string) {
    this.instance.defaults.headers["Authorization"] = authorization;
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

  request<T>(config: AxiosRequestConfig): Promise<T> {
    return this.instance.request(config);
  }
}
