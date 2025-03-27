import CL from "ws";

export interface RequestOptions {
  method: string;
  path: string;
  body?: any;
  query?: any;
  headers?: Record<string, string | string[] | undefined>;
  followRedirect?: boolean;
}

export interface Response<T = any> {
  headers: {
    [header: string]: string;
  };
  body: any;
  statusCode: number;
  statusText: string;
}

export type WebsocketOptions = CL.ClientOptions;
