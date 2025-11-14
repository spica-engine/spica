import { baseApi } from './baseApi';

export interface Identity {
  _id?: string;
  identifier: string;
  password?: string;
  policies?: string[];
  attributes?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface IdentityListResponse {
  data: Identity[];
  meta?: {
    total: number;
  };
}

export interface CreateIdentityRequest {
  identifier: string;
  password: string;
  policies?: string[];
  attributes?: Record<string, any>;
}

export interface UpdateIdentityRequest {
  identifier?: string;
  password?: string;
  policies?: string[];
  attributes?: Record<string, any>;
}

export const identityApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getIdentities: builder.query<IdentityListResponse, { 
      limit?: number; 
      skip?: number; 
      sort?: Record<string, 1 | -1>;
      filter?: Record<string, any>;
    } | void>({
      query: (params) => ({
        url: '/api/passport/identity',
        params: params || {},
      }),
      providesTags: ['Identity'],
    }),

    getIdentity: builder.query<Identity, string>({
      query: (id) => `/api/passport/identity/${id}`,
      providesTags: (result, error, id) => [{ type: 'Identity', id }],
    }),

    createIdentity: builder.mutation<Identity, CreateIdentityRequest>({
      query: (body) => ({
        url: '/api/passport/identity',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Identity'],
    }),

    updateIdentity: builder.mutation<Identity, { id: string; body: UpdateIdentityRequest }>({
      query: ({ id, body }) => ({
        url: `/api/passport/identity/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Identity', id }, 'Identity'],
    }),

    deleteIdentity: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `/api/passport/identity/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Identity', id }, 'Identity'],
    }),

    authenticateIdentity: builder.mutation<{ token: string; identity: Identity }, { identifier: string; password: string }>({
      query: (credentials) => ({
        url: '/api/passport/identify',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
    }),

    verifyIdentity: builder.query<Identity, void>({
      query: () => '/api/passport/verify',
      providesTags: ['Auth'],
    }),

    getIdentityPolicies: builder.query<string[], string>({
      query: (id) => `/api/passport/identity/${id}/policies`,
      providesTags: (result, error, id) => [{ type: 'Identity', id }],
    }),

    updateIdentityPolicies: builder.mutation<Identity, { id: string; policies: string[] }>({
      query: ({ id, policies }) => ({
        url: `/api/passport/identity/${id}/policies`,
        method: 'PUT',
        body: { policies },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Identity', id }, 'Identity'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetIdentitiesQuery,
  useGetIdentityQuery,
  useCreateIdentityMutation,
  useUpdateIdentityMutation,
  useDeleteIdentityMutation,
  useAuthenticateIdentityMutation,
  useVerifyIdentityQuery,
  useGetIdentityPoliciesQuery,
  useUpdateIdentityPoliciesMutation,
} = identityApi;

export const identityApiReducerPath = identityApi.reducerPath;
export const identityApiMiddleware = identityApi.middleware;