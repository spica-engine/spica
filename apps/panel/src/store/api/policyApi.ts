/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import { baseApi } from './baseApi';

// Types
export interface PolicyStatement {
  action: string;
  module: string;
  resource?: {
    include: string[];
    exclude: string[];
  };
}

export interface Policy {
  _id: string;
  name: string;
  description: string;
  statement: PolicyStatement[];
  system: boolean;
}

export interface PolicyListResponse {
  data: Policy[];
  meta: {
    total: number;
  };
}

export interface PolicyOptions {
  filter?: Record<string, any>;
  limit?: number;
  skip?: number;
  sort?: Record<string, number>;
}

export interface CreatePolicyRequest {
  name: string;
  description: string;
  statement: PolicyStatement[];
}

export interface UpdatePolicyRequest {
  name?: string;
  description?: string;
  statement?: PolicyStatement[];
}

export interface Statement {
  action: string;
  module: string;
  resource?: {
    include: string[];
    exclude: string[];
  };
}

export const policyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get all policies
    getPolicies: builder.query<Policy[], PolicyOptions | void>({
      query: (params) => {
        const options = params ?? {};
        const queryParams = new URLSearchParams();
        const { limit, skip, sort, filter } = options;

        if (limit != null) queryParams.append('limit', String(limit));
        if (skip != null) queryParams.append('skip', String(skip));
        if (sort) queryParams.append('sort', JSON.stringify(sort));
        if (filter) queryParams.append('filter', JSON.stringify(filter));

        const qs = queryParams.toString();
        return qs ? `/passport/policy?${qs}` : `/passport/policy`;
      },
      transformResponse: (response: PolicyListResponse) => response.data,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: 'Policy' as const, id: _id })),
              { type: 'Policy', id: 'LIST' },
            ]
          : [{ type: 'Policy', id: 'LIST' }],
    }),

    // Get single policy
    getPolicy: builder.query<Policy, string>({
      query: (policyId) => `/passport/policy/${policyId}`,
      providesTags: (result, error, policyId) => [
        { type: 'Policy', id: policyId },
      ],
    }),

    // Create policy
    createPolicy: builder.mutation<Policy, CreatePolicyRequest>({
      query: (body) => ({
        url: '/passport/policy',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Policy', id: 'LIST' }],
      // Optimistic update
      onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
        try {
          const { data: newPolicy } = await queryFulfilled;
          // Update the policies list cache
          dispatch(
            policyApi.util.updateQueryData('getPolicies', undefined, (draft) => {
              draft.push(newPolicy);
            })
          );
        } catch {
          // If the mutation fails, the cache will be invalidated automatically
        }
      },
    }),

    // Update policy
    updatePolicy: builder.mutation<Policy, { id: string; body: UpdatePolicyRequest }>({
      query: ({ id, body }) => ({
        url: `/passport/policy/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Policy', id },
        { type: 'Policy', id: 'LIST' },
      ],
      // Optimistic update
      onQueryStarted: async ({ id, body }, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          policyApi.util.updateQueryData('getPolicies', undefined, (draft) => {
            const policy = draft.find((p) => p._id === id);
            if (policy) {
              Object.assign(policy, body);
            }
          })
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),

    // Delete policy
    deletePolicy: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `/passport/policy/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'Policy', id },
        { type: 'Policy', id: 'LIST' },
      ],
      // Optimistic update
      onQueryStarted: async (id, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          policyApi.util.updateQueryData('getPolicies', undefined, (draft) => {
            return draft.filter((policy) => policy._id !== id);
          })
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),

    getStatements: builder.query<Statement[], void>({
      query: () => '/passport/identity/statements',
      providesTags: [{ type: 'Policy', id: 'STATEMENTS' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPoliciesQuery,
  useLazyGetPoliciesQuery,
  useGetPolicyQuery,
  useLazyGetPolicyQuery,
  useCreatePolicyMutation,
  useUpdatePolicyMutation,
  useDeletePolicyMutation,
  useGetStatementsQuery,
  useLazyGetStatementsQuery,
} = policyApi;

export const policyApiReducerPath = policyApi.reducerPath;
export const policyApiMiddleware = policyApi.middleware;

