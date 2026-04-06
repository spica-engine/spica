import { baseApi } from './baseApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DashboardComponentType =
  | 'line'
  | 'bar'
  | 'pie'
  | 'doughnut'
  | 'radar'
  | 'scatter'
  | 'bubble'
  | 'polarArea'
  | 'table'
  | 'card'
  | 'statistic';

export enum DashboardRatio {
  OneByOne = '1/1',
  OneByTwo = '1/2',
  TwoByOne = '2/1',
  TwoByTwo = '2/2',
  FourByTwo = '4/2',
  FourByFour = '4/4',
}

export interface DashboardComponent {
  name: string;
  url: string;
  type: DashboardComponentType;
  ratio: DashboardRatio;
}

export interface Dashboard {
  _id?: string;
  name: string;
  icon: string;
  components: DashboardComponent[];
  created_at?: string;
  updated_at?: string;
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

export interface CreateDashboardRequest {
  name: string;
  icon?: string;
  components?: DashboardComponent[];
}

export interface UpdateDashboardRequest {
  name: string;
  icon?: string;
  components?: DashboardComponent[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SMALL_RATIOS: string[] = [
  DashboardRatio.OneByOne,
  DashboardRatio.OneByTwo,
  DashboardRatio.TwoByOne,
];

export function isSmallComponent(ratio: DashboardRatio): boolean {
  return SMALL_RATIOS.includes(ratio);
}

export function getEmptyDashboard(): Dashboard {
  return { name: '', icon: 'leaderboard', components: [] };
}

export function getEmptyComponent(): DashboardComponent {
  return {
    name: '',
    url: '',
    type: 'line',
    ratio: DashboardRatio.TwoByTwo,
  };
}

export const CHART_TYPES: DashboardComponentType[] = [
  'line',
  'bar',
  'pie',
  'doughnut',
  'radar',
  'scatter',
  'bubble',
  'polarArea',
];

export function isChartType(type: DashboardComponentType): boolean {
  return CHART_TYPES.includes(type);
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

const DASHBOARD_TAG = 'Dashboard' as const;

const DASHBOARD_TAGS = {
  LIST: { type: DASHBOARD_TAG, id: 'LIST' },
} as const;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

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
      transformResponse: (response: Dashboard[] | DashboardListResponse): DashboardListResponse =>
        Array.isArray(response) ? { data: response } : response,
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: DASHBOARD_TAG, id: _id })),
              DASHBOARD_TAGS.LIST,
            ]
          : [DASHBOARD_TAGS.LIST],
    }),

    getDashboard: builder.query<Dashboard, string>({
      query: (id) => `/dashboard/${id}`,
      providesTags: (_result, _error, id) => [{ type: DASHBOARD_TAG, id }],
    }),

    createDashboard: builder.mutation<Dashboard, CreateDashboardRequest>({
      query: (body) => ({
        url: '/dashboard',
        method: 'POST',
        body,
      }),
      invalidatesTags: [DASHBOARD_TAGS.LIST],
    }),

    updateDashboard: builder.mutation<Dashboard, { id: string; body: UpdateDashboardRequest }>({
      query: ({ id, body }) => ({
        url: `/dashboard/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: DASHBOARD_TAG, id },
        DASHBOARD_TAGS.LIST,
      ],
    }),

    deleteDashboard: builder.mutation<void, string>({
      query: (id) => ({
        url: `/dashboard/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: DASHBOARD_TAG, id },
        DASHBOARD_TAGS.LIST,
      ],
    }),

    executeDashboardComponent: builder.query<any, { url: string; filter?: string }>({
      query: ({ url, filter }) => {
        const params = new URLSearchParams();
        if (filter) params.append('filter', filter);
        const qs = params.toString();
        return qs ? `${url}?${qs}` : url;
      },
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDashboardsQuery,
  useLazyGetDashboardsQuery,
  useGetDashboardQuery,
  useLazyGetDashboardQuery,
  useCreateDashboardMutation,
  useUpdateDashboardMutation,
  useDeleteDashboardMutation,
  useExecuteDashboardComponentQuery,
  useLazyExecuteDashboardComponentQuery,
} = dashboardApi;

export const dashboardApiReducerPath = dashboardApi.reducerPath;
export const dashboardApiMiddleware = dashboardApi.middleware;
