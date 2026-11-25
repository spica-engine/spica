import {Http} from "./interface.js";
import axios, {AxiosInstance, AxiosResponse} from "axios";
import {Injectable} from "@nestjs/common";

@Injectable()
export class Axios implements Http {
  instance: AxiosInstance;
  constructor() {
    this.instance = axios.create();

    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response.data,
      error => Promise.reject(error.response ? error.response.data : error)
    );
  }

  get<T>(url: string, options?: any): Promise<T> {
    return this.instance.get(url, options) as Promise<T>;
  }
  post<T>(url: string, body: any, options?: any): Promise<T> {
    return this.instance.post(url, body, options) as Promise<T>;
  }
  put<T>(url: string, body: any, options?: any): Promise<T> {
    return this.instance.put(url, body, options) as Promise<T>;
  }
  patch<T>(url: string, body: any, options?: any): Promise<T> {
    return this.instance.patch(url, body, options) as Promise<T>;
  }
  delete(url: string, options?: any) {
    return this.instance.delete(url, options);
  }
}
