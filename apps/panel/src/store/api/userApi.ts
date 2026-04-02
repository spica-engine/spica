import { baseApi } from './baseApi';

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
      query: (params) => ({
        url: 'passport/user',
        params: params || {},
      }),
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
} = userApi;
