import { baseApi } from './baseApi';

export interface SpicaFunction {
  _id?: string;
  name: string;
  description?: string;
  language: 'javascript' | 'typescript';
  handler: string;
  runtime?: 'nodejs' | 'deno';
  timeout?: number;
  memoryLimit?: number;
  env?: Record<string, string>;
  dependencies?: Record<string, string>;
  triggers?: FunctionTrigger[];
  created_at?: Date;
  updated_at?: Date;
}

export interface FunctionTrigger {
  type: 'http' | 'database' | 'schedule' | 'system';
  options: Record<string, any>;
}

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
  handler: string;
  runtime?: 'nodejs' | 'deno';
  timeout?: number;
  memoryLimit?: number;
  env?: Record<string, string>;
  dependencies?: Record<string, string>;
  triggers?: FunctionTrigger[];
}

export interface UpdateFunctionRequest {
  name?: string;
  description?: string;
  language?: 'javascript' | 'typescript';
  handler?: string;
  runtime?: 'nodejs' | 'deno';
  timeout?: number;
  memoryLimit?: number;
  env?: Record<string, string>;
  dependencies?: Record<string, string>;
  triggers?: FunctionTrigger[];
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
        url: 'function',
        params: params || {},
      }),
      providesTags: ['Function'],
    }),

    getFunction: builder.query<SpicaFunction, string>({
      query: (id) => `function/${id}`,
      providesTags: (result, error, id) => [{ type: 'Function', id }],
    }),

    createFunction: builder.mutation<SpicaFunction, CreateFunctionRequest>({
      query: (body) => ({
        url: 'function',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Function'],
    }),

    updateFunction: builder.mutation<SpicaFunction, { id: string; body: UpdateFunctionRequest }>({
      query: ({ id, body }) => ({
        url: `function/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Function', id }, 'Function'],
    }),

    deleteFunction: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `function/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Function', id }, 'Function'],
    }),

    executeFunction: builder.mutation<any, { id: string; body?: ExecuteFunctionRequest }>({
      query: ({ id, body = {} }) => ({
        url: `function/${id}/run`,
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
        url: `function/${functionId}/logs`,
        params,
      }),
      providesTags: (result, error, { functionId }) => [{ type: 'Function', id: functionId }],
    }),

    getFunctionDependencies: builder.query<Record<string, string>, string>({
      query: (id) => `function/${id}/dependencies`,
      providesTags: (result, error, id) => [{ type: 'Function', id }],
    }),

    installFunctionDependencies: builder.mutation<{ message: string }, { id: string; dependencies: Record<string, string> }>({
      query: ({ id, dependencies }) => ({
        url: `function/${id}/dependencies`,
        method: 'POST',
        body: { dependencies },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Function', id }],
    }),

    getFunctionTriggers: builder.query<FunctionTrigger[], string>({
      query: (id) => `function/${id}/triggers`,
      providesTags: (result, error, id) => [{ type: 'Function', id }],
    }),

    updateFunctionTriggers: builder.mutation<SpicaFunction, { id: string; triggers: FunctionTrigger[] }>({
      query: ({ id, triggers }) => ({
        url: `function/${id}/triggers`,
        method: 'PUT',
        body: { triggers },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Function', id }, 'Function'],
    }),

    getFunctionEnv: builder.query<Record<string, string>, string>({
      query: (id) => `function/${id}/env`,
      providesTags: (result, error, id) => [{ type: 'Function', id }],
    }),

    updateFunctionEnv: builder.mutation<SpicaFunction, { id: string; env: Record<string, string> }>({
      query: ({ id, env }) => ({
        url: `function/${id}/env`,
        method: 'PUT',
        body: { env },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Function', id }, 'Function'],
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
  useGetFunctionEnvQuery,
  useUpdateFunctionEnvMutation,
} = functionApi;

export const functionApiReducerPath = functionApi.reducerPath;
export const functionApiMiddleware = functionApi.middleware;