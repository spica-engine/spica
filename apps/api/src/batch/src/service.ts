import {HTTPService} from "./interface";
import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from "axios";

export class AxiosHttpService implements HTTPService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create();
  }

  private _baseURL: string;
  public get baseURL(): string {
    return this._baseURL;
  }
  public set baseURL(value: string) {
    this._baseURL = value;
    this.axiosInstance.defaults.baseURL = this._baseURL;
  }

  request<HTTPResponse>(
    url: string,
    method: "GET" | "DELETE" | "POST" | "PATCH",
    params?: Record<string, any>,
    headers?: Record<string, string>,
    body?: Record<string, any>
  ) {
    return this.axiosInstance
      .request({
        url,
        method,
        params,
        headers,
        data: body
      })
      .then(r => {
        return {...r, body: r.data};
      })
      .catch(e => {
        return {
          ...e.response,
          body: e.response.data
        };
      }) as Promise<HTTPResponse>;
  }
}
