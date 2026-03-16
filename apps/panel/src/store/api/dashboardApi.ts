import { baseApi } from './baseApi';

export interface Dashboard {
  _id?: string;
  name: string;
  description?: string;
  layout?: Record<string, any>;
  widgets?: Record<string, any>[];
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface DashboardListResponse {
  data: Dashboard[];
  meta?: {
    total: number;
  };
}

export interface DashboardOptions {
  filter?: Record<string, any>;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}

const DASHBOARD_TAG = 'Dashboard' as const;

const DASHBOARD_TAGS = {
  LIST: { type: DASHBOARD_TAG, id: 'LIST' },
} as const;

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboards: builder.query<DashboardListResponse, DashboardOptions | void>({
      query: (options: DashboardOptions = {}) => {
        const params = new URLSearchParams();
        const { limit, skip, sort, filter } = options;

        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));
        if (sort) params.append('sort', JSON.stringify(sort));
        if (filter) params.append('filter', JSON.stringify(filter));

        const qs = params.toString();
        return qs ? `/dashboard?${qs}` : `/dashboard`;
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: DASHBOARD_TAG, id: _id })),
              DASHBOARD_TAGS.LIST,
            ]
          : [DASHBOARD_TAGS.LIST],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDashboardsQuery,
  useLazyGetDashboardsQuery,
} = dashboardApi;

export const dashboardApiReducerPath = dashboardApi.reducerPath;
export const dashboardApiMiddleware = dashboardApi.middleware;
