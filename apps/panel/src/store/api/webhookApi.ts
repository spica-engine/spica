import { baseApi } from './baseApi';

export interface WebhookTrigger {
  name: 'database';
  active?: boolean;
  options: {
    collection: string;
    type: 'INSERT' | 'UPDATE' | 'REPLACE' | 'DELETE';
  };
}

export interface Webhook {
  _id?: string;
  title: string;
  url: string;
  body: string;
  trigger: WebhookTrigger;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface WebhookLog {
  _id?: string;
  webhook: string;
  succeed: boolean;
  content: {
    error?: string;
    request?: {
      headers: Record<string, string>;
      url: string;
      body: string;
    };
    response?: {
      status: number;
      statusText: string;
      body: string;
      headers: Record<string, string[]>;
    };
  };
  created_at?: string;
}

export interface WebhookListResponse {
  data: Webhook[];
  meta?: {
    total: number;
  };
}

export interface WebhookOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}

export interface CreateWebhookRequest {
  title: string;
  url: string;
  body: string;
  trigger: WebhookTrigger;
}

export interface UpdateWebhookRequest {
  title?: string;
  url?: string;
  body?: string;
  trigger?: WebhookTrigger;
}

export interface WebhookLogOptions {
  webhooks?: string[];
  begin?: string | Date;
  end?: string | Date;
  succeed?: boolean;
  limit?: number;
  skip?: number;
}

const WEBHOOK_TAG = 'Webhook' as const;

const WEBHOOK_TAGS = {
  LIST: { type: WEBHOOK_TAG, id: 'LIST' },
} as const;

const toIsoString = (value?: string | Date) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.toISOString();
};

export const webhookApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWebhooks: builder.query<WebhookListResponse, WebhookOptions | void>({
      query: (options: WebhookOptions = {}) => {
        const params = new URLSearchParams();
        const { limit, skip, sort } = options;

        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));
        if (sort) params.append('sort', JSON.stringify(sort));

        const qs = params.toString();
        return qs ? `/webhook?${qs}` : `/webhook`;
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: WEBHOOK_TAG, id: _id })),
              WEBHOOK_TAGS.LIST,
            ]
          : [WEBHOOK_TAGS.LIST],
    }),

    getWebhook: builder.query<Webhook, string>({
      query: (id) => `/webhook/${id}`,
      providesTags: (result, error, id) => [{ type: WEBHOOK_TAG, id }],
    }),

    createWebhook: builder.mutation<Webhook, CreateWebhookRequest>({
      query: (body) => ({
        url: '/webhook',
        method: 'POST',
        body,
      }),
      invalidatesTags: [WEBHOOK_TAG],
    }),

    updateWebhook: builder.mutation<Webhook, { id: string; body: UpdateWebhookRequest }>({
      query: ({ id, body }) => ({
        url: `/webhook/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: WEBHOOK_TAG, id }, WEBHOOK_TAG],
    }),

    deleteWebhook: builder.mutation<void, string>({
      query: (id) => ({
        url: `/webhook/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: WEBHOOK_TAG, id }, WEBHOOK_TAG],
    }),

    getWebhookCollections: builder.query<{ id: string; slug: string }[], void>({
      query: () => '/webhook/collections',
    }),

    getWebhookLogs: builder.query<WebhookLog[], WebhookLogOptions | void>({
      query: (options: WebhookLogOptions = {}) => {
        const params = new URLSearchParams();
        const { webhooks, begin, end, succeed, limit, skip } = options;

        if (webhooks?.length) {
          webhooks.forEach((hook) => params.append('webhook', hook));
        }
        const beginIso = toIsoString(begin);
        const endIso = toIsoString(end);
        if (beginIso) params.append('begin', beginIso);
        if (endIso) params.append('end', endIso);
        if (succeed != null) params.append('succeed', String(succeed));
        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));

        const qs = params.toString();
        return qs ? `/webhook/logs?${qs}` : `/webhook/logs`;
      },
    }),

    deleteWebhookLog: builder.mutation<void, string>({
      query: (id) => ({
        url: `/webhook/logs/${id}`,
        method: 'DELETE',
      }),
    }),

    clearWebhookLogs: builder.mutation<void, string[]>({
      query: (ids) => ({
        url: '/webhook/logs',
        method: 'DELETE',
        body: ids,
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetWebhooksQuery,
  useGetWebhookQuery,
  useCreateWebhookMutation,
  useUpdateWebhookMutation,
  useDeleteWebhookMutation,
  useGetWebhookCollectionsQuery,
  useGetWebhookLogsQuery,
  useDeleteWebhookLogMutation,
  useClearWebhookLogsMutation,
} = webhookApi;

export const webhookApiReducerPath = webhookApi.reducerPath;
export const webhookApiMiddleware = webhookApi.middleware;
