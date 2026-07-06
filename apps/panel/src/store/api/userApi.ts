import { baseApi } from './baseApi';
import type { AuthFactorMeta, StartFactorVerificationResponse } from './identityApi';

export interface ProfilerEntry {
  _id?: string;
  op: "command" | "count" | "distinct" | "geoNear" | "getMore" | "group" | "insert" | "mapReduce" | "query" | "remove" | "update";
  ns: string;
  command: Record<string, any>;
  keysExamined: number;
  docsExamined: number;
  numYield: number;
  locks: Record<string, any>;
  millis: number;
  planSummary: string;
  ts: string;
  client: string;
  appName: string;
  allUsers: Array<Record<string, any>>;
  user: string;
}

export interface ProfilerQueryParams {
  filter?: Record<string, any>;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}

export interface User {
  _id?: string;
  username: string;
  password?: string;
  policies?: string[];
  bannedUntil?: string;
  deactivateJwtsBefore?: number;
  lastLogin?: string;
  failedAttempts?: string[];
  authFactor?: Record<string, any>;
  email?: string;
  email_verified_at?: string;
  phone?: string;
  phone_verified_at?: string;
}

export interface UserListResponse {
  data: User[];
  meta?: {
    total: number;
  };
}

export interface CreateUserRequest {
  username: string;
  password: string;
}

export interface UpdateUserRequest {
  username?: string;
  password?: string;
  bannedUntil?: string;
  deactivateJwtsBefore?: number;
}

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<UserListResponse, {
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
        return qs ? `passport/user?${qs}` : 'passport/user';
      },
      transformResponse: (response: UserListResponse | User[]) => {
        if (Array.isArray(response)) {
          return { data: response, meta: { total: response.length } };
        }
        return response;
      },
      providesTags: ['User'],
    }),

    getUser: builder.query<User, string>({
      query: (id) => `passport/user/${id}`,
      providesTags: (result, error, id) => [{ type: 'User', id }],
    }),

    createUser: builder.mutation<User, CreateUserRequest>({
      query: (body) => ({
        url: 'passport/user',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),

    updateUser: builder.mutation<User, { id: string; body: UpdateUserRequest }>({
      query: ({ id, body }) => ({
        url: `passport/user/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'User', id }, 'User'],
    }),

    deleteUser: builder.mutation<void, string>({
      query: (id) => ({
        url: `passport/user/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'User', id }, 'User'],
    }),

    addUserPolicy: builder.mutation<void, { id: string; policyId: string }>({
      query: ({ id, policyId }) => ({
        url: `passport/user/${id}/policy/${policyId}`,
        method: 'PUT',
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'User', id }, 'User'],
    }),

    removeUserPolicy: builder.mutation<void, { id: string; policyId: string }>({
      query: ({ id, policyId }) => ({
        url: `passport/user/${id}/policy/${policyId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'User', id }, 'User'],
    }),

    // ── Multi-factor authentication (2FA) ──────────────────────────────────
    // Spica users are passport entities backed by the same auth-factor machinery
    // as identities; these endpoints mirror `passport/identity/:id/*` factors.
    getUserAuthFactors: builder.query<
      { type: string; title: string; description: string; config: Record<string, any> }[],
      void
    >({
      query: () => 'passport/user/factors',
    }),

    // Begin enrolling a factor on a user. Returns a challenge (TOTP QR data-URL)
    // the user confirms by POSTing a code to the answer url.
    startUserFactorVerification: builder.mutation<
      StartFactorVerificationResponse,
      { id: string; meta: AuthFactorMeta }
    >({
      query: ({ id, meta }) => ({
        url: `passport/user/${id}/start-factor-verification`,
        method: 'POST',
        body: meta,
      }),
    }),

    // Confirm enrollment with the code from the authenticator app. On success the
    // factor is persisted on the user record, so refresh it.
    completeUserFactorVerification: builder.mutation<
      { message: string },
      { id: string; answer: string }
    >({
      query: ({ id, answer }) => ({
        url: `passport/user/${id}/complete-factor-verification`,
        method: 'POST',
        body: { answer },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'User', id }, 'User'],
    }),

    // Disable 2FA: remove the registered factor from the user.
    deleteUserAuthFactor: builder.mutation<void, string>({
      query: (id) => ({
        url: `passport/user/${id}/factors`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'User', id }, 'User'],
    }),

    getUserProfile: builder.query<ProfilerEntry[], ProfilerQueryParams | void>({
      query: (params) => {
        const queryParams: Record<string, string> = {};
        if (params) {
          if (params.filter) queryParams['filter'] = JSON.stringify(params.filter);
          if (params.limit !== undefined) queryParams['limit'] = String(params.limit);
          if (params.skip !== undefined) queryParams['skip'] = String(params.skip);
          if (params.sort) queryParams['sort'] = JSON.stringify(params.sort);
        }
        return { url: 'passport/user/profile', params: queryParams };
      },
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useAddUserPolicyMutation,
  useRemoveUserPolicyMutation,
  useGetUserAuthFactorsQuery,
  useStartUserFactorVerificationMutation,
  useCompleteUserFactorVerificationMutation,
  useDeleteUserAuthFactorMutation,
  useGetUserProfileQuery,
  useLazyGetUserProfileQuery,
} = userApi;
