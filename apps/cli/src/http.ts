import axios, {AxiosInstance} from "axios";
import {context} from "./context";
import {config} from "./config";

export namespace httpService {
  export type Client = {
    [P in keyof Pick<AxiosInstance, "get" | "delete" | "head" | "post" | "patch" | "put">]: <R>(
      ...parameters: Parameters<AxiosInstance[P]>
    ) => Promise<R>;
  };

  export function create({
    baseUrl,
    authorization
  }: {
    authorization: string;
    baseUrl: string;
  }): Client {
    const instance = axios.create({
      baseURL: baseUrl
    });
    instance.interceptors.response.use(
      response => {
        return response.data;
      },
      error => {
        if (!error.response) {
          return Promise.reject(error);
        }
        const data = error.response.data || error.response;
        const message =
          typeof data === "string"
            ? data
            : data?.message || data?.error || JSON.stringify(data);
        const rejection = data instanceof Error ? data : new Error(message);
        return Promise.reject(Object.assign(rejection, {status: error.response.status}));
      }
    );
    instance.defaults.headers.common["Authorization"] = authorization;

    return instance;
  }

  export async function createFromCurrentCtx() {
    const ctx = await context.getCurrent();

    return create({
      baseUrl: ctx.url,
      authorization: ctx.authorization
    });
  }
}
