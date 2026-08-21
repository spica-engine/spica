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
        const status = error.response.status;
        const data = error.response.data || error.response;
        // Keep the HTTP status (and the axios error code) on the rejected error so
        // callers can tell a 404 apart from a throttled or failed request.
        if (data instanceof Error) {
          const known = data as Error & {status?: number};
          if (known.status === undefined) {
            known.status = status;
          }
          return Promise.reject(known);
        }
        const message =
          typeof data === "string" ? data : data?.message || data?.error || JSON.stringify(data);
        const rejection = new Error(message) as Error & {status?: number; code?: string};
        rejection.status = status;
        rejection.code = error.code;
        return Promise.reject(rejection);
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
