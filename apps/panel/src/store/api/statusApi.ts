import {baseApi} from "./baseApi";

// A single tracked metric as returned by every backend `getStatus()`
// (`packages/database/src/collection.ts`, `*.service.ts`). `limit` is omitted
// when no cap is configured for that resource.
export type StatusMetric = {
  current: number;
  limit?: number;
  unit: string;
};

// Sections are keyed by name. Most are `StatusMetric`, but some providers expose
// free-form shapes (e.g. the function scheduler `workers` section), so the value
// type stays permissive and callers must narrow defensively.
export type StatusSection = StatusMetric | Record<string, any>;

export type StatusModule = {
  module: string;
  status: Record<string, StatusSection>;
};

export type HealthResponse = {status: string};

export type ModuleStatusArgs = {
  module: string;
  begin?: string;
  end?: string;
};

export const statusApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getStatuses: builder.query<StatusModule[], void>({
      query: () => ({url: "status"})
    }),

    getModuleStatus: builder.query<StatusModule, ModuleStatusArgs>({
      query: ({module, begin, end}) => ({
        url: `status/${module}`,
        params: {...(begin ? {begin} : {}), ...(end ? {end} : {})}
      })
    }),

    getLiveness: builder.query<HealthResponse, void>({
      query: () => ({url: "status/live"})
    }),

    getReadiness: builder.query<HealthResponse, void>({
      query: () => ({url: "status/ready"})
    })
  }),
  overrideExisting: false
});

export const {
  useGetStatusesQuery,
  useGetModuleStatusQuery,
  useGetLivenessQuery,
  useGetReadinessQuery
} = statusApi;

export const statusApiReducerPath = statusApi.reducerPath;
export const statusApiMiddleware = statusApi.middleware;
