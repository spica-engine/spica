export interface BatchRequest<T> {
  requests: Request<T>[];
  concurrency?: number;
}

export interface BatchResponse<T> {
  responses: Response<T>[];
}

type RequestMethods = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Request<T = any> {
  id: string;
  method: RequestMethods;
  url: string;
  body: T;
  headers: object;
}

export interface Response<T = any> {
  id: string;
  status: number;
  body: T;
  headers: object;
}

export interface BatchOptions {
  port: string;
}

interface SuccessResponse<P, R = P> {
  request: P;
  response: R;
}

interface FailureResponse<P> {
  request: P;
  response: {
    message: string;
    error: string;
  };
}

export interface ManyResponse<P, R> {
  successes: SuccessResponse<P, R>[];
  failures: FailureResponse<P>[];
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
    headers?: Record<string, any>,
    body?: Record<string, any>
  ): Promise<R>;

  baseURL: string;
}

export const HTTP_SERVICE = Symbol.for("HTTP_SERVICE");
export const BATCH_OPTIONS = Symbol.for("BATCH_OPTIONS");
