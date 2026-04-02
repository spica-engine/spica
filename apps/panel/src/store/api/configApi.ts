import { baseApi } from './baseApi';

export interface ConfigItem {
  _id?: string;
  module: string;
  options: Record<string, unknown>;
}

export interface UpdateConfigRequest {
  module: string;
  options: Record<string, unknown>;
}

export const configApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getConfigs: builder.query<ConfigItem[], void>({
      query: () => '/config',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ module }) => ({ type: 'Config' as const, id: module })),
              { type: 'Config', id: 'LIST' },
            ]
          : [{ type: 'Config', id: 'LIST' }],
    }),

    getConfig: builder.query<ConfigItem, string>({
      query: (module) => `/config/${module}`,
      providesTags: (_result, _error, module) => [{ type: 'Config', id: module }],
    }),

    updateConfig: builder.mutation<ConfigItem, UpdateConfigRequest>({
      query: ({ module, options }) => ({
        url: `/config/${module}`,
        method: 'PUT',
        body: options,
      }),
      invalidatesTags: (_result, _error, { module }) => [
        { type: 'Config', id: module },
        { type: 'Config', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetConfigsQuery,
  useGetConfigQuery,
  useLazyGetConfigQuery,
  useUpdateConfigMutation,
} = configApi;

export const configApiReducerPath = configApi.reducerPath;
export const configApiMiddleware = configApi.middleware;
