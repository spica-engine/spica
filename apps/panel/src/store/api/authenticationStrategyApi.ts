import { baseApi } from './baseApi';

export interface AuthenticationStrategy {
  _id: string;
  name: string;
  title: string;
  type: "saml" | "oauth";
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

export interface AddStrategyInput {
  type: "saml" | "oauth";
  name: string;
  title: string;
  options: {
    ip: {
      login_url: string;
      logout_url: string;
      certificate: string;
    };
  };
  icon?: string;
}

export interface UpdateStrategyInput extends AddStrategyInput {
  _id: string;
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

    addStrategy: builder.mutation<AuthenticationStrategy, AddStrategyInput>({
      query: (body) => ({
        url: "passport/strategy",
        method: "POST",
        body,
      }),
      invalidatesTags: [STRATEGY_TAGS.LIST],
    }),

    updateStrategy: builder.mutation<
      AuthenticationStrategy,
      UpdateStrategyInput & { _hasChanges?: boolean }
    >({
      queryFn: async (arg, _queryApi, _extraOptions, baseQuery) => {
        if (arg._hasChanges === false) {
          return {
            data: {
              _id: arg._id,
              name: arg.name,
              title: arg.title,
              type: arg.type,
              options: arg.options,
            } as AuthenticationStrategy,
          };
        }
        const { _id, _hasChanges, ...body } = arg;
        const result = await baseQuery({
          url: `passport/strategy/${_id}`,
          method: "PUT",
          body,
        });
        if (result.error) return { error: result.error };
        return { data: result.data as AuthenticationStrategy };
      },
      invalidatesTags: (result, error, arg) =>
        arg._hasChanges === false
          ? []
          : [
              STRATEGY_TAGS.LIST,
              { type: STRATEGY_TAG, id: arg._id },
            ],
    }),

    deleteStrategy: builder.mutation<void, string>({
      query: (id) => ({
        url: `passport/strategy/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        STRATEGY_TAGS.LIST,
        { type: STRATEGY_TAG, id },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAuthenticationStrategiesQuery,
  useLazyGetAuthenticationStrategiesQuery,
  useGetAuthenticationStrategyQuery,
  useLazyGetAuthenticationStrategyQuery,
  useAddStrategyMutation,
  useUpdateStrategyMutation,
  useDeleteStrategyMutation,
} = authenticationStrategyApi;

export const authenticationStrategyApiReducerPath =
  authenticationStrategyApi.reducerPath;
export const authenticationStrategyApiMiddleware =
  authenticationStrategyApi.middleware;
