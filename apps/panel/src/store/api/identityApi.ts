import { baseApi } from './baseApi';

export interface AuthFactorMeta {
  type: string;
  config: Record<string, any>;
  title?: string;
  description?: string;
}

export interface Identity {
  _id?: string;
  identifier: string;
  password?: string;
  policies?: string[];
  authFactor?: AuthFactorMeta;
  deactivateJwtsBefore?: number;
  lastLogin?: string;
  failedAttempts?: string[];
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
  deactivateJwtsBefore?: number;
}

export interface UpdateIdentityRequest {
  identifier?: string;
  password?: string;
  deactivateJwtsBefore?: number;
  authFactor?: AuthFactorMeta;
}

export const identityApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getIdentities: builder.query<IdentityListResponse, { 
      limit?: number; 
      skip?: number; 
      sort?: Record<string, 1 | -1>;
      filter?: Record<string, any>;
      paginate?: boolean;
    } | void>({
      query: (params) => ({
        url: 'passport/identity',
        params: params || {},
      }),
      transformResponse: (response: IdentityListResponse | Identity[]) => {
        if (Array.isArray(response)) {
          return { data: response, meta: { total: response.length } };
        }
        return response;
      },
      providesTags: ['Identity'],
    }),

    getIdentity: builder.query<Identity, string>({
      query: (id) => `passport/identity/${id}`,
      providesTags: (result, error, id) => [{ type: 'Identity', id }],
    }),

    createIdentity: builder.mutation<Identity, CreateIdentityRequest>({
      query: (body) => ({
        url: 'passport/identity',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Identity'],
    }),

    updateIdentity: builder.mutation<Identity, { id: string; body: UpdateIdentityRequest }>({
      query: ({ id, body }) => ({
        url: `passport/identity/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Identity', id }, 'Identity'],
    }),

    deleteIdentity: builder.mutation<void, string>({
      query: (id) => ({
        url: `passport/identity/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Identity', id }, 'Identity'],
    }),

    authenticateIdentity: builder.mutation<{ token: string; identity: Identity }, { identifier: string; password: string }>({
      query: (credentials) => ({
        url: 'passport/identify',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
    }),

    verifyIdentity: builder.query<Identity, void>({
      query: () => 'passport/verify',
      providesTags: ['Auth'],
    }),

    addIdentityPolicy: builder.mutation<void, { id: string; policyId: string }>({
      query: ({ id, policyId }) => ({
        url: `passport/identity/${id}/policy/${policyId}`,
        method: 'PUT',
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Identity', id }, 'Identity'],
    }),

    removeIdentityPolicy: builder.mutation<void, { id: string; policyId: string }>({
      query: ({ id, policyId }) => ({
        url: `passport/identity/${id}/policy/${policyId}`,
        method: 'DELETE',
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
  useAddIdentityPolicyMutation,
  useRemoveIdentityPolicyMutation,
} = identityApi;

export const identityApiReducerPath = identityApi.reducerPath;
export const identityApiMiddleware = identityApi.middleware;