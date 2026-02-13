import { baseApi } from './baseApi';

export interface Activity {
  _id?: string;
  [key: string]: any;
}

export interface ActivityListResponse {
  data: Activity[];
  meta?: {
    total: number;
  };
}

export interface ActivityFilterResource {
  $all?: string[];
  $in?: string[];
}

export interface ActivityOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  filter?: Record<string, any>;
  /** Filter by identifier (e.g. User.0.xxx) */
  identifier?: string;
  /** Filter by action types: 1=Insert, 2=Update, 3=Delete */
  action?: number | number[];
  /** Start of date range (ISO string) */
  begin?: string | Date;
  /** End of date range (ISO string) */
  end?: string | Date;
  /** Resource filter: { $all: [module, bucketId?], $in: [documentIds] } */
  resource?: ActivityFilterResource;
}

const ACTIVITY_TAG = 'Activity' as const;

const ACTIVITY_TAGS = {
  LIST: { type: ACTIVITY_TAG, id: 'LIST' },
} as const;

const toIsoString = (value?: string | Date) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.toISOString();
};

/**
 * Builds activity filter options from form values.
 * Matches the /api/activity query params: identifier, action, begin, end, resource.
 */
export function buildActivityFilterOptions(values: {
  identifier?: string;
  actionTypes?: number[];
  module?: string | null;
  bucketId?: string | null;
  documentIds?: string[];
  dateRange?: { from: Date | null; to: Date | null };
}): ActivityOptions {
  const opts: ActivityOptions = { limit: 20, skip: 0 };

  if (values.identifier?.trim()) {
    opts.identifier = values.identifier.trim();
  }

  if (values.actionTypes?.length) {
    opts.action = values.actionTypes;
  }

  if (values.dateRange?.from) {
    opts.begin = values.dateRange.from;
  }
  if (values.dateRange?.to) {
    opts.end = values.dateRange.to;
  }

  const resource: ActivityFilterResource = {};
  if (values.module) {
    resource.$all = [values.module];
    if (values.module === 'bucket' && values.bucketId) {
      resource.$all.push(values.bucketId);
    }
  }
  if (values.documentIds?.length) {
    resource.$in = values.documentIds;
  }
  if (resource.$all?.length || resource.$in?.length) {
    opts.resource = resource;
  }

  return opts;
}

export const activitiesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getActivities: builder.query<Activity[], ActivityOptions | void>({
      query: (options: ActivityOptions = {}) => {
        const params = new URLSearchParams();
        const { limit, skip, sort, filter, identifier, action, begin, end, resource } = options;

        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));
        if (sort) params.append('sort', JSON.stringify(sort));
        if (filter) params.append('filter', JSON.stringify(filter));
        if (identifier?.trim()) params.append('identifier', identifier.trim());
        if (action != null) {
          const actions = Array.isArray(action) ? action : [action];
          actions.forEach((a) => params.append('action', String(a)));
        }
        const beginIso = toIsoString(begin);
        const endIso = toIsoString(end);
        if (beginIso) params.append('begin', beginIso);
        if (endIso) params.append('end', endIso);
        if (resource && (resource.$all?.length || resource.$in?.length)) {
          params.append('resource', JSON.stringify(resource));
        }

        const qs = params.toString();
        return qs ? `/activity?${qs}` : `/activity`;
      },
      transformResponse: (response: Activity[] | ActivityListResponse) =>
        Array.isArray(response) ? response : response.data ?? [],
      providesTags: (result) =>
        result?.length
          ? [
              ...result.map(({ _id }) => ({ type: ACTIVITY_TAG, id: _id })),
              ACTIVITY_TAGS.LIST,
            ]
          : [ACTIVITY_TAGS.LIST],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetActivitiesQuery,
  useLazyGetActivitiesQuery,
} = activitiesApi;

export const activitiesApiReducerPath = activitiesApi.reducerPath;
export const activitiesApiMiddleware = activitiesApi.middleware;
