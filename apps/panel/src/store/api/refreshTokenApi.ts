import { baseApi } from './baseApi';
import { serializeFilter, type FilterInput } from '../../utils/serializeFilter';
import { idOf, type SystemRecord } from "../../utils/recordKey";

export interface RefreshToken extends SystemRecord {
  identity?: string;
  user?: string;
  created_at: string;
  expired_at: string;
  last_used_at: string;
  disabled?: boolean;
}

export interface RefreshTokenListResponse {
  data: RefreshToken[];
  meta: {
    total: number;
  };
}

export interface RefreshTokenOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  filter?: FilterInput;
}

const REFRESH_TOKEN_TAG = 'RefreshToken' as const;

const REFRESH_TOKEN_TAGS = {
  LIST: { type: REFRESH_TOKEN_TAG, id: 'LIST' },
} as const;

export const refreshTokenApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRefreshTokens: builder.query<RefreshTokenListResponse, RefreshTokenOptions | void>({
      query: (options: RefreshTokenOptions = {}) => {
        const params = new URLSearchParams();
        const { limit, skip, sort, filter } = options;

        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));
        if (sort) params.append('sort', JSON.stringify(sort));
        if (filter) params.append('filter', serializeFilter(filter));
        params.append('paginate', 'true');

        const qs = params.toString();
        return `passport/refresh-token?${qs}`;
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map((token) => ({ type: REFRESH_TOKEN_TAG, id: idOf(token) })),
              REFRESH_TOKEN_TAGS.LIST,
            ]
          : [REFRESH_TOKEN_TAGS.LIST],
    }),

    getRefreshToken: builder.query<RefreshToken, string>({
      query: (id) => `passport/refresh-token/${id}`,
      providesTags: (result, error, id) => [{ type: REFRESH_TOKEN_TAG, id }],
    }),

    updateRefreshToken: builder.mutation<RefreshToken, { id: string; disabled: boolean }>({
      query: ({ id, disabled }) => ({
        url: `passport/refresh-token/${id}`,
        method: 'PUT',
        body: { disabled },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: REFRESH_TOKEN_TAG, id },
        REFRESH_TOKEN_TAGS.LIST,
      ],
    }),

    deleteRefreshToken: builder.mutation<void, string>({
      query: (id) => ({
        url: `passport/refresh-token/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: REFRESH_TOKEN_TAG, id },
        REFRESH_TOKEN_TAGS.LIST,
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetRefreshTokensQuery,
  useGetRefreshTokenQuery,
  useUpdateRefreshTokenMutation,
  useDeleteRefreshTokenMutation,
} = refreshTokenApi;

export const refreshTokenApiReducerPath = refreshTokenApi.reducerPath;
export const refreshTokenApiMiddleware = refreshTokenApi.middleware;
