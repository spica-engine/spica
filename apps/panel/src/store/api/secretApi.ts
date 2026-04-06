import { baseApi } from './baseApi';

export interface Secret {
  _id: string;
  key: string;
}

export interface SecretInput {
  key: string;
  value: string;
}

export interface SecretListResponse {
  data: Secret[];
  meta: {
    total: number;
  };
}

export interface SecretOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  filter?: Record<string, any>;
}

const SECRET_TAG = 'Secret' as const;

const SECRET_TAGS = {
  LIST: { type: SECRET_TAG, id: 'LIST' },
} as const;

export const secretApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSecrets: builder.query<SecretListResponse, SecretOptions | void>({
      query: (options: SecretOptions = {}) => {
        const params = new URLSearchParams();
        const { limit, skip, sort, filter } = options;

        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));
        if (sort) params.append('sort', JSON.stringify(sort));
        if (filter) params.append('filter', JSON.stringify(filter));
        params.append('paginate', 'true');

        const qs = params.toString();
        return `secret?${qs}`;
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: SECRET_TAG, id: _id })),
              SECRET_TAGS.LIST,
            ]
          : [SECRET_TAGS.LIST],
    }),

    getSecret: builder.query<Secret, string>({
      query: (id) => `secret/${id}`,
      providesTags: (_result, _error, id) => [{ type: SECRET_TAG, id }],
    }),

    createSecret: builder.mutation<Secret, SecretInput>({
      query: (body) => ({
        url: 'secret',
        method: 'POST',
        body,
      }),
      invalidatesTags: [SECRET_TAGS.LIST],
    }),

    updateSecret: builder.mutation<Secret, { id: string } & SecretInput>({
      query: ({ id, ...body }) => ({
        url: `secret/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: SECRET_TAG, id },
        SECRET_TAGS.LIST,
      ],
    }),

    deleteSecret: builder.mutation<void, string>({
      query: (id) => ({
        url: `secret/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: SECRET_TAG, id },
        SECRET_TAGS.LIST,
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSecretsQuery,
  useGetSecretQuery,
  useCreateSecretMutation,
  useUpdateSecretMutation,
  useDeleteSecretMutation,
} = secretApi;

export const secretApiReducerPath = secretApi.reducerPath;
export const secretApiMiddleware = secretApi.middleware;
