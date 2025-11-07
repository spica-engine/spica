import { baseApi } from './baseApi';

// Storage tag constants
const STORAGE_TAG = 'Storage' as const;

const STORAGE_TAGS = {
  LIST: { type: STORAGE_TAG, id: 'LIST' },
  BROWSE: { type: STORAGE_TAG, id: 'BROWSE' },
} as const;

const createStorageIdTags = (id: string) => [
  { type: STORAGE_TAG, id },
  STORAGE_TAGS.LIST,
  STORAGE_TAGS.BROWSE,
];

export interface Storage {
  _id?: string;
  name: string;
  url?: string;
  content?: {
    type: string;
    size?: number;
  };
}

export interface StorageListResponse {
  data: Storage[];
  meta: {
    total: number;
  };
}

export interface StorageOptions {
  filter?: object;
  limit?: number;
  skip?: number;
  sort?: object;
  paginate?: boolean;
}

export interface UploadFilesRequest {
  files: FileList;
  prefix?: string;
}

export interface UpdateStorageItemRequest {
  id: string;
  file: File;
}

export interface UpdateStorageNameRequest {
  id: string;
  name: string;
}

export const storageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStorageItems: builder.query<StorageListResponse, StorageOptions | void>({
      query: (options: StorageOptions = {}) => {
        const params = new URLSearchParams();
        const { limit, skip, sort, filter, paginate } = options;

        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));
        if (sort) params.append('sort', JSON.stringify(sort));
        if (filter) params.append('filter', JSON.stringify(filter));
        params.append('paginate', JSON.stringify(paginate ?? false));

        const qs = params.toString();
        return qs ? `/storage?${qs}` : `/storage`;
      },
      providesTags: (result) =>
        result && result.data
          ? [
              ...result.data.map(({ _id }) => ({ type: STORAGE_TAG, id: _id })),
              STORAGE_TAGS.LIST,
            ]
          : [STORAGE_TAGS.LIST],
    }),

    getStorageItem: builder.query<Storage, string>({
      query: (id) => `/storage/${id}`,
      providesTags: (result, error, id) => [{ type: STORAGE_TAG, id }],
    }),

    uploadFiles: builder.mutation<Storage[], UploadFilesRequest>({
      query: ({ files, prefix }) => {
        const formData = new FormData();
        Array.from(files).forEach((file) => formData.append('files', file));
        if (prefix) formData.append('prefix', prefix);
        return {
          url: '/storage',
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: [STORAGE_TAGS.LIST, STORAGE_TAGS.BROWSE],
    }),

    updateStorageItem: builder.mutation<Storage, UpdateStorageItemRequest>({
      query: ({ id, file }) => {
        const formData = new FormData();
        formData.append('file', file);

        return {
          url: `/storage/${id}`,
          method: 'PUT',
          body: formData,
        };
      },
      invalidatesTags: (result, error, { id }) => createStorageIdTags(id),
    }),

    deleteStorageItem: builder.mutation<void, string>({
      query: (id) => ({
        url: `/storage/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => createStorageIdTags(id),
    }),

    updateStorageName: builder.mutation<Storage, UpdateStorageNameRequest>({
      query: ({ id, name }) => ({
        url: `/storage/${id}`,
        method: 'PATCH',
        body: { name },
      }),
      invalidatesTags: (result, error, { id }) => createStorageIdTags(id),
    }),

    getSubResources: builder.query<
      StorageListResponse,
      { id: string; options?: StorageOptions }
    >({
      query: ({ id, options = {} }) => {
        const params = new URLSearchParams();
        const { limit, skip, sort, filter, paginate } = options;

        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));
        if (sort) params.append('sort', JSON.stringify(sort));
        if (filter) params.append('filter', JSON.stringify(filter));
        params.append('paginate', JSON.stringify(paginate ?? false));

        return `/storage/${id}/sub-resources?${params.toString()}`;
      },
      providesTags: (result, error, { id }) => [
        { type: STORAGE_TAG, id: `${id}-sub` },
      ],
    }),

    browseStorage: builder.query<StorageListResponse, StorageOptions & { path?: string }>({
      query: (options: StorageOptions & { path?: string } = {}) => {
        const params = new URLSearchParams();
        const { path, limit, skip, sort, filter, paginate } = options;

        if (path) params.append('path', path);
        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));
        if (sort) params.append('sort', JSON.stringify(sort));
        if (filter) params.append('filter', JSON.stringify(filter));
        params.append('paginate', JSON.stringify(paginate ?? false));

        const qs = params.toString();
        return qs ? `/storage/browse?${qs}` : `/storage/browse`;
      },
      providesTags: (result) =>
        result && result.data
          ? [
              ...result.data.map(({ _id }) => ({ type: STORAGE_TAG, id: _id })),
              STORAGE_TAGS.BROWSE,
            ]
          : [STORAGE_TAGS.BROWSE],
    })
  }),
});

export const {
  useGetStorageItemsQuery,
  useLazyGetStorageItemsQuery,
  useGetStorageItemQuery,
  useUploadFilesMutation,
  useUpdateStorageItemMutation,
  useDeleteStorageItemMutation,
  useUpdateStorageNameMutation,
  useGetSubResourcesQuery,
  useBrowseStorageQuery,
  useLazyBrowseStorageQuery,
} = storageApi;
