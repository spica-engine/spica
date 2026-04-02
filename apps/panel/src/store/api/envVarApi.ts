import { baseApi } from './baseApi';

export interface EnvVar {
  _id: string;
  key: string;
  value: string;
}

export interface EnvVarInput {
  key: string;
  value: string;
}

export interface EnvVarListResponse {
  data: EnvVar[];
  meta: {
    total: number;
  };
}

export interface EnvVarOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  filter?: Record<string, any>;
}

const ENV_VAR_TAG = 'EnvVar' as const;

const ENV_VAR_TAGS = {
  LIST: { type: ENV_VAR_TAG, id: 'LIST' },
} as const;

export const envVarApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEnvVars: builder.query<EnvVarListResponse, EnvVarOptions | void>({
      query: (options: EnvVarOptions = {}) => {
        const params = new URLSearchParams();
        const { limit, skip, sort, filter } = options;

        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));
        if (sort) params.append('sort', JSON.stringify(sort));
        if (filter) params.append('filter', JSON.stringify(filter));
        params.append('paginate', 'true');

        const qs = params.toString();
        return `env-var?${qs}`;
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: ENV_VAR_TAG, id: _id })),
              ENV_VAR_TAGS.LIST,
            ]
          : [ENV_VAR_TAGS.LIST],
    }),

    getEnvVar: builder.query<EnvVar, string>({
      query: (id) => `env-var/${id}`,
      providesTags: (_result, _error, id) => [{ type: ENV_VAR_TAG, id }],
    }),

    createEnvVar: builder.mutation<EnvVar, EnvVarInput>({
      query: (body) => ({
        url: 'env-var',
        method: 'POST',
        body,
      }),
      invalidatesTags: [ENV_VAR_TAGS.LIST],
    }),

    updateEnvVar: builder.mutation<EnvVar, { id: string } & EnvVarInput>({
      query: ({ id, ...body }) => ({
        url: `env-var/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: ENV_VAR_TAG, id },
        ENV_VAR_TAGS.LIST,
      ],
    }),

    deleteEnvVar: builder.mutation<void, string>({
      query: (id) => ({
        url: `env-var/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: ENV_VAR_TAG, id },
        ENV_VAR_TAGS.LIST,
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEnvVarsQuery,
  useGetEnvVarQuery,
  useCreateEnvVarMutation,
  useUpdateEnvVarMutation,
  useDeleteEnvVarMutation,
} = envVarApi;

export const envVarApiReducerPath = envVarApi.reducerPath;
export const envVarApiMiddleware = envVarApi.middleware;
