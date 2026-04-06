import {baseApi} from "./baseApi";

export type BatchRequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface BatchRequestItem {
  id: string;
  method: BatchRequestMethod;
  url: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface BatchRequestPayload {
  requests: BatchRequestItem[];
  concurrency?: number;
}

export interface BatchResponsePayload<T = unknown> {
  status?: number;
  statusCode?: number;
  statusText?: string;
  data?: T;
  headers?: Record<string, string>;
}

export interface BatchResponseItem<T = unknown> {
  id: string;
  response?: BatchResponsePayload<T>;
  error?: {
    status?: number;
    message?: string;
    [key: string]: unknown;
  };
}

export interface BatchResponse<T = unknown> {
  responses: BatchResponseItem<T>[];
}

export const batchApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    executeBatch: builder.mutation<BatchResponse, BatchRequestPayload>({
      query: body => ({
        url: "/batch",
        method: "POST",
        body
      })
    })
  })
});

export const {useExecuteBatchMutation} = batchApi;
export const batchApiReducerPath = batchApi.reducerPath;
export const batchApiMiddleware = batchApi.middleware;

