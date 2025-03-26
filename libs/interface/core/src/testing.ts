import {Headers, Method} from "got";
import CL from "ws";

export interface RequestOptions {
  method: Method;
  path: string;
  body?: any;
  query?: any;
  headers?: Headers;
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
