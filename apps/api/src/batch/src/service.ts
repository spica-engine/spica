import {HTTPService} from "./interface";
import axios, {AxiosInstance, AxiosRequestConfig} from "axios";

export class AxiosHttpService implements HTTPService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create();
  }

  async get<T>(
    url: string,
    params?: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<T> {
    const config: AxiosRequestConfig = {
      params,
      headers
    };
    const response = await this.axiosInstance.get<T>(url, config);
    return response.data;
  }

  async post<T>(
    url: string,
    data: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<T> {
    const config: AxiosRequestConfig = {headers};
    const response = await this.axiosInstance.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(
    url: string,
    data: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<T> {
    const config: AxiosRequestConfig = {headers};
    const response = await this.axiosInstance.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(
    url: string,
    params?: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<T> {
    const config: AxiosRequestConfig = {
      params,
      headers
    };
    const response = await this.axiosInstance.delete<T>(url, config);
    return response.data;
  }
}
