import { baseApi } from './baseApi';

export interface AuthenticationStrategy {
  _id: string;
  name: string;
  title: string;
  type: string;
  icon?: string;
  [key: string]: any;
}

export interface AuthenticationStrategyListResponse {
  data: AuthenticationStrategy[];
  meta?: {
    total: number;
  };
}

export interface AuthenticationStrategyOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  filter?: Record<string, any>;
}

type AuthenticationStrategyListApiResponse =
  | AuthenticationStrategy[]
  | AuthenticationStrategyListResponse;

const STRATEGY_TAG = 'Strategy' as const;

const STRATEGY_TAGS = {
  LIST: { type: STRATEGY_TAG, id: 'LIST' },
} as const;

export const authenticationStrategyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAuthenticationStrategies: builder.query<
      AuthenticationStrategy[],
      AuthenticationStrategyOptions | void
    >({
      query: (options: AuthenticationStrategyOptions = {}) => {
        const params = new URLSearchParams();
        const { limit, skip, sort, filter } = options;

        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));
        if (sort) params.append('sort', JSON.stringify(sort));
        if (filter) params.append('filter', JSON.stringify(filter));

        const qs = params.toString();
        return qs ? `passport/strategy?${qs}` : `passport/strategy`;
      },
      transformResponse: (response: AuthenticationStrategyListApiResponse) =>
        Array.isArray(response) ? response : response.data,
      providesTags: (result) =>
        result?.length
          ? [
              ...result.map(({ _id }) => ({ type: STRATEGY_TAG, id: _id })),
              STRATEGY_TAGS.LIST,
            ]
          : [STRATEGY_TAGS.LIST],
    }),

    getAuthenticationStrategy: builder.query<AuthenticationStrategy, string>({
      query: (id) => `passport/strategy/${id}`,
      providesTags: (result, error, id) => [{ type: STRATEGY_TAG, id }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAuthenticationStrategiesQuery,
  useLazyGetAuthenticationStrategiesQuery,
  useGetAuthenticationStrategyQuery,
  useLazyGetAuthenticationStrategyQuery,
} = authenticationStrategyApi;

export const authenticationStrategyApiReducerPath =
  authenticationStrategyApi.reducerPath;
export const authenticationStrategyApiMiddleware =
  authenticationStrategyApi.middleware;
