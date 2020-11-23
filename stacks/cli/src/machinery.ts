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
    instance.interceptors.response.use(
      value => {
        return value.data;
      },
      error => {
        console.log(error);
        return error;
      }
    );
    instance.defaults.headers.common["Authorization"] = authorization;

    return instance;
  }

  export async function createFromConfig() {
    const {context: name} = await config.get();
    if (!name) {
      throw new Error(
        `No context has been selected.\n$ spica context switch <name> to switch context.`
      );
    }
    const ctx = context.get(name);
    if (!ctx) {
      throw new Error(
        `Could not find the context ${name}\n$ spica context set --name="${name}" --apikey="<APIKEY_HERE>" to create this context.`
      );
    }
    return create({
      baseUrl: ctx.url,
      authorization: ctx.authorization
    });
  }
}
