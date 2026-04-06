import { baseApi } from './baseApi';

export interface ApiKey {
  _id?: string;
  name: string;
  description?: string;
  key?: string;
  policies?: string[];
  active?: boolean;
  expiresAt?: string | null;
  created_at?: Date;
  updated_at?: Date;
  [key: string]: any;
}

export interface ApiKeyListResponse {
  data: ApiKey[];
  meta?: {
    total: number;
  };
}

export interface CreateApiKeyRequest {
  name: string;
  description?: string;
  policies?: string[];
  active?: boolean;
  expiresAt?: string | null;
}

export interface UpdateApiKeyRequest {
  name?: string;
  description?: string;
  policies?: string[];
  active?: boolean;
  expiresAt?: string | null;
}

export interface ApiKeyOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  filter?: Record<string, any>;
}

const API_KEY_TAG = 'ApiKey' as const;

const API_KEY_TAGS = {
  LIST: { type: API_KEY_TAG, id: 'LIST' },
} as const;

export const apiKeyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getApiKeys: builder.query<ApiKeyListResponse, ApiKeyOptions | void>({
      query: (options: ApiKeyOptions = {}) => {
        const params = new URLSearchParams();
        const { limit, skip, sort, filter } = options;

        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));
        if (sort) params.append('sort', JSON.stringify(sort));
        if (filter) params.append('filter', JSON.stringify(filter));

        const qs = params.toString();
        return qs ? `passport/apikey?${qs}` : `passport/apikey`;
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: API_KEY_TAG, id: _id })),
              API_KEY_TAGS.LIST,
            ]
          : [API_KEY_TAGS.LIST],
    }),

    getApiKey: builder.query<ApiKey, string>({
      query: (id) => `passport/apikey/${id}`,
      providesTags: (result, error, id) => [{ type: 'ApiKey', id }],
    }),

    createApiKey: builder.mutation<ApiKey, CreateApiKeyRequest>({
      query: (body) => ({
        url: 'passport/apikey',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ApiKey'],
    }),

    updateApiKey: builder.mutation<ApiKey, { id: string; body: UpdateApiKeyRequest }>({
      query: ({ id, body }) => ({
        url: `passport/apikey/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'ApiKey', id }, 'ApiKey'],
    }),

    deleteApiKey: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `passport/apikey/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'ApiKey', id }, 'ApiKey'],
    }),

    getApiKeyPolicies: builder.query<string[], string>({
      query: (id) => `passport/apikey/${id}/policies`,
      providesTags: (result, error, id) => [{ type: 'ApiKey', id }],
    }),

    updateApiKeyPolicies: builder.mutation<ApiKey, { id: string; policies: string[] }>({
      query: ({ id, policies }) => ({
        url: `passport/apikey/${id}/policies`,
        method: 'PUT',
        body: { policies },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'ApiKey', id }, 'ApiKey'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetApiKeysQuery,
  useGetApiKeyQuery,
  useCreateApiKeyMutation,
  useUpdateApiKeyMutation,
  useDeleteApiKeyMutation,
  useGetApiKeyPoliciesQuery,
  useUpdateApiKeyPoliciesMutation,
} = apiKeyApi;

export const apiKeyApiReducerPath = apiKeyApi.reducerPath;
export const apiKeyApiMiddleware = apiKeyApi.middleware;
