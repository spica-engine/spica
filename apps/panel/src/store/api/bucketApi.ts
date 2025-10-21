import { baseApi } from './baseApi';

// Types (migrated from bucketService.ts)
export type BucketDataType = {
  data: { [key: string]: any }[];
  meta: {
    total: number;
  };
};

export type BucketDataWithIdType = BucketDataType & { bucketId: string };

export type BucketType = {
  _id: string;
  title: string;
  properties: Properties;
  required?: string[];
  description?: string;
  icon?: string;
  primary?: string;
  readOnly?: boolean;
  history?: boolean;
  order?: number;
  category?: string;
  acl?: {
    write: string;
    read: string;
  };
  [key: string]: any;
};

type Properties = { [key: string]: Property };

export type Property =
  | BasicProperty
  | ArrayProperty
  | ObjectProperty
  | RelationProperty
  | LocationProperty;

interface IProperty {
  type: string;
  enum?: any[];
  [key: string]: any;
}

interface BasicProperty extends IProperty {
  type: "string" | "textarea" | "color" | "richtext" | "storage" | "number" | "date" | "boolean";
  options: {
    translate: boolean;
    position?: string;
  };
}

interface ArrayProperty extends IProperty {
  type: "array" | "multiselect";
  items: Property;
}

interface ObjectProperty extends IProperty {
  type: "object";
  properties: Properties;
  required?: string[];
}

interface RelationProperty extends IProperty {
  type: "relation";
  bucketId: string;
  relationType: "onetoone" | "onetomany";
}

interface LocationProperty extends IProperty {
  type: "location";
}

export type BucketDataQueryType = {
  paginate?: boolean;
  relation?: boolean;
  limit?: number;
  sort?: Record<string, number>;
  skip?: number;
  filter?: Record<string, any>;
};

export type BucketDataQueryWithIdType = BucketDataQueryType & { bucketId: string };

export interface CreateBucketRequest {
  title: string;
  order: number;
  description?: string;
  icon?: string;
  primary?: string;
  readOnly?: boolean;
  history?: boolean;
  properties?: Properties;
  acl?: {
    write: string;
    read: string;
  };
}

export interface UpdateBucketRequest {
  title?: string;
  description?: string;
  icon?: string;
  primary?: string;
  readOnly?: boolean;
  history?: boolean;
  properties?: Properties;
  required?: string[];
  acl?: {
    write: string;
    read: string;
  };
  order?: number;
  category?: string;
}

export interface BucketListResponse {
  data: BucketType[];
  meta?: {
    total: number;
  };
}

export const bucketApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get all buckets
    getBuckets: builder.query<BucketType[], {
      limit?: number;
      skip?: number;
      sort?: Record<string, 1 | -1>;
      filter?: Record<string, any>;
    } | void>({
      query: (params) => ({
        url: 'api/bucket',
        params: params || {},
      }),
      providesTags: ['Bucket'],
    }),

    // Get bucket data
    getBucketData: builder.query<BucketDataType, {
      bucketId: string;
      paginate?: boolean;
      relation?: boolean;
      limit?: number;
      sort?: Record<string, number>;
      skip?: number;
      filter?: Record<string, any>;
    }>({
      query: ({ bucketId, ...params }) => {
        // Convert params to query string (excluding undefined values)
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            if (typeof value === 'object') {
              queryParams.append(key, JSON.stringify(value));
            } else {
              queryParams.append(key, String(value));
            }
          }
        });
        
        return {
          url: `api/bucket/${bucketId}/data`,
          params: Object.fromEntries(queryParams),
        };
      },
      providesTags: (result, error, { bucketId }) => [
        { type: 'BucketData', id: bucketId },
        'BucketData',
      ],
    }),

    // Create bucket
    createBucket: builder.mutation<BucketType, CreateBucketRequest>({
      query: (body) => {
        const bucketData = {
          title: body.title,
          description: body.description || "Describe your new bucket",
          icon: body.icon || "view_stream",
          primary: body.primary || "title",
          readOnly: body.readOnly || false,
          history: body.history || false,
          properties: body.properties || {
            title: {
              type: "string",
              title: "title",
              description: "Title of the row",
              options: { position: "left", translate: false }
            },
            description: {
              type: "textarea",
              title: "description",
              description: "Description of the row",
              options: { position: "right", translate: false }
            }
          },
          acl: body.acl || {
            write: "true==true",
            read: "true==true"
          },
          order: body.order
        };

        return {
          url: 'api/bucket',
          method: 'POST',
          body: bucketData,
        };
      },
      invalidatesTags: ['Bucket'],
      // Optimistic update
      onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
        try {
          const { data: newBucket } = await queryFulfilled;
          // Update the buckets list cache
          dispatch(
            bucketApi.util.updateQueryData('getBuckets', undefined, (draft) => {
              draft.push(newBucket);
            })
          );
        } catch {
          // If the mutation fails, the cache will be invalidated automatically
        }
      },
    }),

    // Update bucket
    updateBucket: builder.mutation<BucketType, { id: string; body: UpdateBucketRequest }>({
      query: ({ id, body }) => ({
        url: `api/bucket/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Bucket', id },
        { type: 'BucketData', id },
        'Bucket',
      ],
      // Optimistic update
      onQueryStarted: async ({ id, body }, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          bucketApi.util.updateQueryData('getBuckets', undefined, (draft) => {
            const bucket = draft.find((b) => b._id === id);
            if (bucket) {
              Object.assign(bucket, body);
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

    // Delete bucket
    deleteBucket: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `api/bucket/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'Bucket', id },
        { type: 'BucketData', id },
        'Bucket',
      ],
      // Optimistic update
      onQueryStarted: async (id, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          bucketApi.util.updateQueryData('getBuckets', undefined, (draft) => {
            return draft.filter((bucket) => bucket._id !== id);
          })
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),

    // Change bucket category
    changeBucketCategory: builder.mutation<BucketType, { bucketId: string; category: string }>({
      query: ({ bucketId, category }) => ({
        url: `api/bucket/${bucketId}`,
        method: 'PATCH',
        body: { category },
      }),
      invalidatesTags: (result, error, { bucketId }) => [
        { type: 'Bucket', id: bucketId },
        'Bucket',
      ],
      // Optimistic update
      onQueryStarted: async ({ bucketId, category }, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          bucketApi.util.updateQueryData('getBuckets', undefined, (draft) => {
            const bucket = draft.find((b) => b._id === bucketId);
            if (bucket) {
              bucket.category = category;
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

    // Update bucket order
    updateBucketOrder: builder.mutation<BucketType, { bucketId: string; order: number }>({
      query: ({ bucketId, order }) => ({
        url: `api/bucket/${bucketId}`,
        method: 'PATCH',
        body: { order },
      }),
      invalidatesTags: (result, error, { bucketId }) => [
        { type: 'Bucket', id: bucketId },
        'Bucket',
      ],
      // Optimistic update
      onQueryStarted: async ({ bucketId, order }, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          bucketApi.util.updateQueryData('getBuckets', undefined, (draft) => {
            const bucket = draft.find((b) => b._id === bucketId);
            if (bucket) {
              bucket.order = order;
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

    // Create bucket field (update bucket properties)
    createBucketField: builder.mutation<BucketType, BucketType>({
      query: (modifiedBucket) => ({
        url: `api/bucket/${modifiedBucket._id}`,
        method: 'PUT',
        body: modifiedBucket,
      }),
      invalidatesTags: (result, error, bucket) => [
        { type: 'Bucket', id: bucket._id },
        { type: 'BucketData', id: bucket._id },
        'Bucket',
      ],
      // Optimistic update
      onQueryStarted: async (modifiedBucket, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          bucketApi.util.updateQueryData('getBuckets', undefined, (draft) => {
            const bucketIndex = draft.findIndex((b) => b._id === modifiedBucket._id);
            if (bucketIndex !== -1) {
              draft[bucketIndex] = modifiedBucket;
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

    // Update bucket rules (ACL)
    updateBucketRules: builder.mutation<BucketType, { 
      bucket: BucketType; 
      newRules: { write: string; read: string } 
    }>({
      query: ({ bucket, newRules }) => ({
        url: `api/bucket/${bucket._id}`,
        method: 'PUT',
        body: { ...bucket, acl: newRules },
      }),
      invalidatesTags: (result, error, { bucket }) => [
        { type: 'Bucket', id: bucket._id },
        'Bucket',
      ],
      // Optimistic update
      onQueryStarted: async ({ bucket, newRules }, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          bucketApi.util.updateQueryData('getBuckets', undefined, (draft) => {
            const foundBucket = draft.find((b) => b._id === bucket._id);
            if (foundBucket) {
              foundBucket.acl = newRules;
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

    // Delete bucket history
    deleteBucketHistory: builder.mutation<{ message: string }, BucketType>({
      query: (bucket) => ({
        url: `api/bucket/${bucket._id}/history`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, bucket) => [
        { type: 'Bucket', id: bucket._id },
        { type: 'BucketData', id: bucket._id },
        'Bucket',
      ],
    }),

    // Update bucket history setting
    updateBucketHistory: builder.mutation<BucketType, BucketType>({
      query: (bucket) => ({
        url: `api/bucket/${bucket._id}`,
        method: 'PUT',
        body: {
          ...bucket,
          history: !bucket.history,
        },
      }),
      invalidatesTags: (result, error, bucket) => [
        { type: 'Bucket', id: bucket._id },
        'Bucket',
      ],
      // Optimistic update
      onQueryStarted: async (bucket, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          bucketApi.util.updateQueryData('getBuckets', undefined, (draft) => {
            const foundBucket = draft.find((b) => b._id === bucket._id);
            if (foundBucket) {
              foundBucket.history = !foundBucket.history;
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

    // Update bucket readonly setting
    updateBucketReadonly: builder.mutation<BucketType, BucketType>({
      query: (bucket) => ({
        url: `api/bucket/${bucket._id}`,
        method: 'PUT',
        body: {
          ...bucket,
          readOnly: !bucket.readOnly,
        },
      }),
      invalidatesTags: (result, error, bucket) => [
        { type: 'Bucket', id: bucket._id },
        'Bucket',
      ],
      // Optimistic update
      onQueryStarted: async (bucket, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          bucketApi.util.updateQueryData('getBuckets', undefined, (draft) => {
            const foundBucket = draft.find((b) => b._id === bucket._id);
            if (foundBucket) {
              foundBucket.readOnly = !foundBucket.readOnly;
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

    // Rename bucket
    renameBucket: builder.mutation<BucketType, { newTitle: string; bucket: BucketType }>({
      query: ({ newTitle, bucket }) => {
        const body = { ...bucket, title: newTitle };
        // Remove UI-specific properties
        delete (body as any).section;
        delete (body as any).index;
        
        return {
          url: `api/bucket/${bucket._id}`,
          method: 'PUT',
          body,
        };
      },
      invalidatesTags: (result, error, { bucket }) => [
        { type: 'Bucket', id: bucket._id },
        'Bucket',
      ],
      // Optimistic update
      onQueryStarted: async ({ newTitle, bucket }, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          bucketApi.util.updateQueryData('getBuckets', undefined, (draft) => {
            const foundBucket = draft.find((b) => b._id === bucket._id);
            if (foundBucket) {
              foundBucket.title = newTitle;
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

    // Update bucket limitation
    updateBucketLimitation: builder.mutation<BucketType, { bucketId: string; body: BucketType }>({
      query: ({ bucketId, body }) => ({
        url: `api/bucket/${bucketId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { bucketId }) => [
        { type: 'Bucket', id: bucketId },
        'Bucket',
      ],
    }),

    // Update bucket limitation fields
    updateBucketLimitationFields: builder.mutation<BucketType, BucketType>({
      query: (bucket) => ({
        url: `api/bucket/${bucket._id}`,
        method: 'PUT',
        body: bucket,
      }),
      invalidatesTags: (result, error, bucket) => [
        { type: 'Bucket', id: bucket._id },
        'Bucket',
      ],
    }),

    // Delete bucket entry
    deleteBucketEntry: builder.mutation<{ message: string }, { entryId: string; bucketId: string }>({
      query: ({ entryId, bucketId }) => ({
        url: `api/bucket/${bucketId}/data/${entryId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { bucketId }) => [
        { type: 'BucketData', id: bucketId },
        'BucketData',
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBucketsQuery,
  useGetBucketDataQuery,
  useCreateBucketMutation,
  useUpdateBucketMutation,
  useDeleteBucketMutation,
  useChangeBucketCategoryMutation,
  useUpdateBucketOrderMutation,
  useCreateBucketFieldMutation,
  useUpdateBucketRulesMutation,
  useDeleteBucketHistoryMutation,
  useUpdateBucketHistoryMutation,
  useUpdateBucketReadonlyMutation,
  useRenameBucketMutation,
  useUpdateBucketLimitationMutation,
  useUpdateBucketLimitationFieldsMutation,
  useDeleteBucketEntryMutation,
} = bucketApi;

export const bucketApiReducerPath = bucketApi.reducerPath;
export const bucketApiMiddleware = bucketApi.middleware;