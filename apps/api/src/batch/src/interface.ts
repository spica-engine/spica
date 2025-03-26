export interface BatchRequest {
  requests: Request[];
  concurrency: number;
}

export interface BatchResponse {
  responses: Response[];
}

type RequestMethods = "GET" | "POST" | "PATCH" | "DELETE";

export interface Request {
  id: string;
  method: RequestMethods;
  url: string;
  body: any;
  headers: Record<string, string>;
}

export interface Response {
  id: string;
  status: number;
  body: any;
  headers: Record<string, string>;
}

export interface BatchOptions {
  port: string;
}

export interface HTTPResponse {
  body: any;
  status: number;
  headers: Record<string, string>;
}

export interface HTTPService {
  request<R = HTTPResponse>(
    url: string,
    method: RequestMethods,
    params?: Record<string, any>,
    headers?: Record<string, string>,
    body?: Record<string, any>
  ): Promise<R>;

  baseURL: string;
}

export const HTTP_SERVICE = Symbol.for("HTTP_SERVICE");
export const BATCH_OPTIONS = Symbol.for("BATCH_OPTIONS");
