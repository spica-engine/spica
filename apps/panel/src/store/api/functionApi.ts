import { baseApi } from './baseApi';

export interface ResolvedEnvVar {
  _id: string;
  key: string;
  value: string;
}

export interface ResolvedSecret {
  _id: string;
  key: string;
}

export interface SpicaFunction {
  _id?: string;
  name: string;
  description?: string;
  language: 'javascript' | 'typescript';
  runtime?: 'nodejs' | 'deno';
  timeout?: number;
  memoryLimit?: number;
  env?: Record<string, string>;
  env_vars?: ResolvedEnvVar[];
  secrets?: ResolvedSecret[];
  dependencies?: Record<string, string>;
  triggers?: TriggerMap | FunctionTrigger[];
  order?: number;
  category?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface FunctionTrigger {
  handler?: string;
  type: 'http' | 'firehose' | 'database' | 'schedule' | 'system' | 'bucket';
  active?: boolean;
  options: Record<string, any>;
}

export type TriggerMap = Record<string, { type: string; active?: boolean; options: Record<string, any> }>;

export interface FunctionExecution {
  _id?: string;
  function: string;
  status: 'running' | 'success' | 'failed';
  startedAt?: Date;
  finishedAt?: Date;
  logs?: string[];
  error?: string;
  result?: any;
}

export interface FunctionLog {
  _id: string;
  function: string;
  event_id: string;
  content: string;
  channel: 'stderr' | 'stdout';
  created_at: string;
  level: number;
}

export interface EnqueuerDescription {
  icon: string;
  name: string;
  title: string;
  description: string;
}

export interface Enqueuer {
  description: EnqueuerDescription;
  options: Record<string, any>;
}

export interface Runtime {
  name: string;
  title: string;
  description: string;
}

export interface FunctionInformation {
  enqueuers: Enqueuer[];
  runtimes: Runtime[];
  timeout: number;
}

export interface Dependency {
  name: string;
  version: string;
}

export interface FunctionListResponse {
  data: SpicaFunction[];
  meta?: {
    total: number;
  };
}

export interface FunctionExecutionListResponse {
  data: FunctionExecution[];
  meta?: {
    total: number;
  };
}

export interface CreateFunctionRequest {
  name: string;
  description?: string;
  language: 'javascript' | 'typescript';
  runtime?: 'nodejs' | 'deno';
  timeout?: number;
  memoryLimit?: number;
  env?: Record<string, string>;
  dependencies?: Record<string, string>;
  triggers?: TriggerMap;
}

export interface UpdateFunctionRequest {
  name?: string;
  description?: string;
  language?: 'javascript' | 'typescript';
  runtime?: 'nodejs' | 'deno';
  timeout?: number;
  memoryLimit?: number;
  triggers?: TriggerMap;
}

export interface ExecuteFunctionRequest {
  target?: any;
  options?: Record<string, any>;
}

export const functionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFunctions: builder.query<FunctionListResponse, { 
      limit?: number; 
      skip?: number; 
      sort?: Record<string, 1 | -1>;
      filter?: Record<string, any>;
    } | void>({
      query: (params) => ({
        url: '/function',
        params: params || {},
      }),
      providesTags: ['Function'],
    }),

    getFunction: builder.query<SpicaFunction, string>({
      query: (id) => `/function/${id}`,
      providesTags: (result, error, id) => [{ type: 'Function', id }],
    }),

    createFunction: builder.mutation<SpicaFunction, CreateFunctionRequest>({
      query: (body) => ({
        url: '/function',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Function'],
    }),

    updateFunction: builder.mutation<SpicaFunction, { id: string; body: UpdateFunctionRequest }>({
      query: ({ id, body }) => ({
        url: `/function/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Function', id }, 'Function'],
    }),

    deleteFunction: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `/function/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Function', id }, 'Function'],
    }),

    executeFunction: builder.mutation<any, { id: string; body?: ExecuteFunctionRequest }>({
      query: ({ id, body = {} }) => ({
        url: `/function/${id}/run`,
        method: 'POST',
        body,
      }),
    }),

    getFunctionExecutions: builder.query<FunctionExecutionListResponse, { 
      functionId: string;
      limit?: number; 
      skip?: number; 
      sort?: Record<string, 1 | -1>;
    }>({
      query: ({ functionId, ...params }) => ({
        url: `/function/${functionId}/logs`,
        params,
      }),
      providesTags: (result, error, { functionId }) => [{ type: 'Function', id: functionId }],
    }),

    getFunctionDependencies: builder.query<Record<string, string>, string>({
      query: (id) => `/function/${id}/dependencies`,
      providesTags: (result, error, id) => [{ type: 'Function', id }],
    }),

    installFunctionDependencies: builder.mutation<{ message: string }, { id: string; dependencies: Record<string, string> }>({
      query: ({ id, dependencies }) => ({
        url: `/function/${id}/dependencies`,
        method: 'POST',
        body: { dependencies },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Function', id }],
    }),

    getFunctionTriggers: builder.query<FunctionTrigger[], string>({
      query: (id) => `/function/${id}/triggers`,
      providesTags: (result, error, id) => [{ type: 'Function', id }],
    }),

    updateFunctionTriggers: builder.mutation<SpicaFunction, { id: string; triggers: FunctionTrigger[] }>({
      query: ({ id, triggers }) => ({
        url: `/function/${id}/triggers`,
        method: 'PUT',
        body: { triggers },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Function', id }, 'Function'],
    }),

    injectEnvVar: builder.mutation<void, { functionId: string; envVarId: string }>({
      query: ({ functionId, envVarId }) => ({
        url: `/function/${functionId}/env-var/${envVarId}`,
        method: 'PUT',
      }),
      invalidatesTags: (result, error, { functionId }) => [{ type: 'Function', id: functionId }, 'Function'],
    }),

    ejectEnvVar: builder.mutation<void, { functionId: string; envVarId: string }>({
      query: ({ functionId, envVarId }) => ({
        url: `/function/${functionId}/env-var/${envVarId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { functionId }) => [{ type: 'Function', id: functionId }, 'Function'],
    }),

    injectSecret: builder.mutation<void, { functionId: string; secretId: string }>({
      query: ({ functionId, secretId }) => ({
        url: `/function/${functionId}/secret/${secretId}`,
        method: 'PUT',
      }),
      invalidatesTags: (result, error, { functionId }) => [{ type: 'Function', id: functionId }, 'Function'],
    }),

    ejectSecret: builder.mutation<void, { functionId: string; secretId: string }>({
      query: ({ functionId, secretId }) => ({
        url: `/function/${functionId}/secret/${secretId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { functionId }) => [{ type: 'Function', id: functionId }, 'Function'],
    }),

    updateFunctionOrder: builder.mutation<SpicaFunction, { functionId: string; order: number }>({
      query: ({ functionId, order }) => ({
        url: `/function/${functionId}`,
        method: 'PATCH',
        body: JSON.stringify({ order }),
        headers: {
          'Content-Type': 'application/merge-patch+json',
        },
      }),
      invalidatesTags: (result, error, { functionId }) => [
        { type: 'Function', id: functionId },
        'Function',
      ],
      onQueryStarted: async ({ functionId, order }, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          functionApi.util.updateQueryData('getFunctions', undefined, (draft) => {
            const fn = draft.data.find((f) => f._id === functionId);
            if (fn) {
              fn.order = order;
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

    changeFunctionCategory: builder.mutation<SpicaFunction, { functionId: string; category: string }>({
      query: ({ functionId, category }) => ({
        url: `/function/${functionId}`,
        method: 'PATCH',
        body: JSON.stringify({ category }),
        headers: {
          'Content-Type': 'application/merge-patch+json',
        },
      }),
      invalidatesTags: (result, error, { functionId }) => [
        { type: 'Function', id: functionId },
        'Function',
      ],
      onQueryStarted: async ({ functionId, category }, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          functionApi.util.updateQueryData('getFunctions', undefined, (draft) => {
            const fn = draft.data.find((f) => f._id === functionId);
            if (fn) {
              fn.category = category;
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

    getFunctionIndex: builder.query<{ index: string }, string>({
      query: (id) => `/function/${id}/index`,
      providesTags: (result, error, id) => [{ type: 'Function', id: `${id}-index` }],
    }),

    updateFunctionIndex: builder.mutation<void, { id: string; index: string }>({
      query: ({ id, index }) => ({
        url: `/function/${id}/index`,
        method: 'POST',
        body: { index },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Function', id: `${id}-index` }],
    }),

    getFunctionInformation: builder.query<FunctionInformation, void>({
      query: () => '/function/information',
    }),

    addFunctionDependency: builder.mutation<void, { id: string; name: string }>({
      query: ({ id, name }) => ({
        url: `/function/${id}/dependencies`,
        method: 'POST',
        body: { name: [name] },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Function', id }],
    }),

    deleteFunctionDependency: builder.mutation<void, { id: string; name: string }>({
      query: ({ id, name }) => ({
        url: `/function/${id}/dependencies/${name}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Function', id }],
    }),

    getFunctionLogs: builder.query<FunctionLog[], {
      functions?: string[];
      begin?: string;
      end?: string;
      limit?: number;
      skip?: number;
      sort?: Record<string, 1 | -1>;
      levels?: number[];
    }>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params.functions) {
          params.functions.forEach(fn => searchParams.append('functions', fn));
        }
        if (params.begin) searchParams.set('begin', params.begin);
        if (params.end) searchParams.set('end', params.end);
        if (params.limit) searchParams.set('limit', params.limit.toString());
        if (params.skip) searchParams.set('skip', params.skip.toString());
        if (params.sort) searchParams.set('sort', JSON.stringify(params.sort));
        if (params.levels) {
          params.levels.forEach(level => searchParams.append('levels', level.toString()));
        }
        return `/function-logs?${searchParams.toString()}`;
      },
    }),

    clearFunctionLogs: builder.mutation<void, { functionId: string; begin?: string; end?: string }>({
      query: ({ functionId, begin, end }) => {
        const searchParams = new URLSearchParams();
        if (begin) searchParams.set('begin', begin);
        if (end) searchParams.set('end', end);
        return {
          url: `/function-logs/${functionId}?${searchParams.toString()}`,
          method: 'DELETE',
        };
      },
    }),

    renameFunction: builder.mutation<SpicaFunction, { newName: string; fn: SpicaFunction }>({
      query: ({ newName, fn }) => {
        const body = { ...fn, name: newName };
        return {
          url: `/function/${fn._id}`,
          method: 'PUT',
          body,
        };
      },
      invalidatesTags: (result, error, { fn }) => [
        { type: 'Function', id: fn._id },
        'Function',
      ],
      onQueryStarted: async ({ newName, fn }, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          functionApi.util.updateQueryData('getFunctions', undefined, (draft) => {
            const found = draft.data.find((f) => f._id === fn._id);
            if (found) {
              found.name = newName;
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
  }),
  overrideExisting: false,
});

export const {
  useGetFunctionsQuery,
  useGetFunctionQuery,
  useCreateFunctionMutation,
  useUpdateFunctionMutation,
  useDeleteFunctionMutation,
  useExecuteFunctionMutation,
  useGetFunctionExecutionsQuery,
  useGetFunctionDependenciesQuery,
  useInstallFunctionDependenciesMutation,
  useGetFunctionTriggersQuery,
  useUpdateFunctionTriggersMutation,
  useInjectEnvVarMutation,
  useEjectEnvVarMutation,
  useInjectSecretMutation,
  useEjectSecretMutation,
  useUpdateFunctionOrderMutation,
  useChangeFunctionCategoryMutation,
  useRenameFunctionMutation,
  useGetFunctionIndexQuery,
  useUpdateFunctionIndexMutation,
  useGetFunctionInformationQuery,
  useAddFunctionDependencyMutation,
  useDeleteFunctionDependencyMutation,
  useGetFunctionLogsQuery,
  useClearFunctionLogsMutation,
} = functionApi;

export const functionApiReducerPath = functionApi.reducerPath;
export const functionApiMiddleware = functionApi.middleware;