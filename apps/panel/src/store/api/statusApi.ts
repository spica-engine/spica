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

/**
 * The driver's own declaration of what this installation can do (K-10).
 *
 * The backend is chosen when the instance is provisioned and never changes afterwards (K-8), so the panel
 * reads this once and treats it as fixed. The whole reason the endpoint exists is for the panel to stop
 * offering surfaces the backend has no counterpart for — before this was wired up, a PostgreSQL
 * installation still showed the collation option, the Mongo-only index kinds and the profiler views, and
 * the user only found out when the request failed.
 *
 * Mirrors `DriverCapabilities` in `packages/database/driver/src/capabilities.ts`. `"subset"` is a real
 * third state on two of these: not everything works, but enough does that hiding the surface would be
 * wrong too.
 */
export type DriverCapabilities = {
  backend: string;
  version: string;
  rawMongoFilter: boolean | "subset";
  aggregationPipeline: boolean | "subset";
  queryProfiler: false | "system.profile" | "pg_stat_statements";
  nativeTTLIndex: boolean;
  indexOptions: {sparse: boolean; collation: boolean; partial: boolean};
  directAccessDevkit: false | "@spica-devkit/database" | "@spica-devkit/postgres";
  referentialIntegrity: boolean;
  maxLifetimeFieldsPerCollection: number | null;
  requiresReplicaSet: boolean;
};

export type CapabilitiesResponse = {
  backend: string;
  database: string;
  capabilities: DriverCapabilities;
};

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
    }),

    getCapabilities: builder.query<CapabilitiesResponse, void>({
      query: () => ({url: "status/capabilities"})
    })
  }),
  overrideExisting: false
});

export const {
  useGetStatusesQuery,
  useGetModuleStatusQuery,
  useGetLivenessQuery,
  useGetReadinessQuery,
  useGetCapabilitiesQuery
} = statusApi;

export const statusApiReducerPath = statusApi.reducerPath;
export const statusApiMiddleware = statusApi.middleware;
