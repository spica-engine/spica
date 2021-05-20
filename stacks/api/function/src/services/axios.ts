import {Http} from "./interface";
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
    return this.instance.get(url, options);
  }
  post<T>(url: string, body: any, options?: any): Promise<T> {
    return this.instance.post(url, body, options);
  }
  put<T>(url: string, body: any, options?: any): Promise<T> {
    return this.instance.put(url, body, options);
  }
  patch<T>(url: string, body: any, options?: any): Promise<T> {
    return this.instance.patch(url, body, options);
  }
  delete(url: string, options?: any) {
    return this.instance.delete(url, options);
  }
}
