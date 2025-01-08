import axios, {AxiosRequestConfig, AxiosInstance, AxiosResponse} from "axios";

export interface HttpService {
  baseUrl: string;
  setBaseUrl(url: string): void;
  setAuthorization(authorization: string): void;
  setWriteDefaults(writeDefaults: {headers: {[key: string]: string}}): void;

  get<T>(url: string, options?: any): Promise<T>;
  post<T>(url: string, body: any, options?: any): Promise<T>;
  put<T>(url: string, body: any, options?: any): Promise<T>;
  patch<T>(url: string, body: any, options?: any): Promise<T>;
  delete(url: string, options?: any);
  request<T>(options: any): Promise<T>;
}

export function logWarning(response: any) {
  const warning = response.headers["warning"];
  if (warning) {
    console.warn(warning);
  }
}

export class Axios implements HttpService {
  private instance: AxiosInstance;
  baseUrl: string;

  private readonly interceptors = {
    request: {
      onFulfilled: (
        request: Omit<AxiosRequestConfig, "headers"> & {
          headers: any; // headers type from axios 0.x.x
        }
      ) => {
        request.maxBodyLength = Number.MAX_SAFE_INTEGER;
        request.maxContentLength = Number.MAX_SAFE_INTEGER;

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

  constructor(config: AxiosRequestConfig) {
    this.instance = axios.create(config);

    this.instance.interceptors.request.use(
      this.interceptors.request.onFulfilled,
      this.interceptors.request.onRejected
    );

    this.instance.interceptors.response.use(
      this.interceptors.response.onFulfilled,
      this.interceptors.response.onRejected
    );

    this.baseUrl = this.instance.defaults.baseURL;
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
