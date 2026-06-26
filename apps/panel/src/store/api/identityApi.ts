import { baseApi } from './baseApi';
import type { AuthFactorMeta, StartFactorVerificationResponse } from './types';

export type { AuthFactorMeta, StartFactorVerificationResponse };

/** A factor type the server offers, returned by `GET passport/identity/factors`. */
export interface AuthFactorSchema {
  type: string;
  title: string;
  description: string;
  config: Record<string, { type: string; enum?: any[] }>;
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
      query: (options = {}) => {
        const params = new URLSearchParams();
        const {limit, skip, sort, filter, paginate} = options;

        if (paginate != null) params.append('paginate', String(paginate));
        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));
        if (sort) params.append('sort', JSON.stringify(sort));
        if (filter) params.append('filter', JSON.stringify(filter));

        const qs = params.toString();
        return qs ? `passport/identity?${qs}` : 'passport/identity';
      },
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

    // ── Multi-factor authentication (2FA) ──────────────────────────────────
    // Available factor types (currently just "totp").
    getAuthFactors: builder.query<AuthFactorSchema[], void>({
      query: () => 'passport/identity/factors',
    }),

    // Begin enrolling a factor on an identity. Returns a challenge (TOTP QR
    // data-URL) the user confirms by POSTing a code to the answer url.
    startFactorVerification: builder.mutation<
      StartFactorVerificationResponse,
      { id: string; meta: AuthFactorMeta }
    >({
      query: ({ id, meta }) => ({
        url: `passport/identity/${id}/start-factor-verification`,
        method: 'POST',
        body: meta,
      }),
    }),

    // Confirm enrollment with the code from the authenticator app. On success
    // the factor is persisted on the identity, so refresh it.
    completeFactorVerification: builder.mutation<
      { message: string },
      { id: string; answer: string }
    >({
      query: ({ id, answer }) => ({
        url: `passport/identity/${id}/complete-factor-verification`,
        method: 'POST',
        body: { answer },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Identity', id }, 'Identity'],
    }),

    // Disable 2FA: remove the registered factor from the identity.
    deleteAuthFactor: builder.mutation<void, string>({
      query: (id) => ({
        url: `passport/identity/${id}/factors`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Identity', id }, 'Identity'],
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
  useGetAuthFactorsQuery,
  useStartFactorVerificationMutation,
  useCompleteFactorVerificationMutation,
  useDeleteAuthFactorMutation,
} = identityApi;

export const identityApiReducerPath = identityApi.reducerPath;
export const identityApiMiddleware = identityApi.middleware;