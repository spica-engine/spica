import {HttpService} from "./request";

interface InitializeOptions {
  publicUrl?: string;
}

export interface ApikeyInitialization extends InitializeOptions {
  apikey: string;
}

export interface IdentityInitialization extends InitializeOptions {
  identity: string;
}

export interface InitializationResult {
  authorization: string;
  publicUrl: string;
  service: HttpService;
}

export interface IndexResult<T> {
  meta: {
    total: number;
  };
  data: T[];
}

export interface BatchRequest<T> {
  requests: Request<T>[];
  concurrency?: number;
}

export interface BatchResponse<T> {
  responses: Response<T>[];
}

export type RequestMethods = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

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

export interface SuccessResponse<P, R = P> {
  request: P;
  response: R;
}

export interface FailureResponse<P> {
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
