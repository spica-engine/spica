import axios, {AxiosInstance} from "axios";
import {context} from "./context";
import {config} from "./config";

export namespace machinery {
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
    instance.defaults.headers.common["Authorization"] = authorization;

    return instance;
  }

  export async function createFromConfig() {
    const {context: name} = await config.get();
    const ctx = context.get(name);
    return create({
      baseUrl: ctx.url,
      authorization: ctx.authorization
    });
  }
}
