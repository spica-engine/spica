import { baseApi } from './baseApi';
import { idOf, type SystemRecord } from '../../utils/recordKey';

export interface Activity extends SystemRecord {
  [key: string]: any;
}

export interface ActivityListResponse {
  data: Activity[];
  meta?: {
    total: number;
  };
}

export interface ActivityOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  /** Filter by identifier (e.g. User.0.xxx) */
  identifier?: string;
  /** Filter by action types: 1=Insert, 2=Update, 3=Delete */
  action?: number | number[];
  /** Start of date range (ISO string) */
  begin?: string | Date;
  /** End of date range (ISO string) */
  end?: string | Date;
  /** Values the activity's resource must hold: [module, bucketId?] */
  resource?: string[];
  /** Document ids of which the activity's resource must hold at least one */
  documentId?: string[];
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

export const activitiesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getActivities: builder.query<Activity[], ActivityOptions | void>({
      query: (options: ActivityOptions = {}) => {
        const params = new URLSearchParams();
        const { limit, skip, sort, identifier, action, begin, end, resource, documentId } =
          options;

        if (limit != null) params.append('limit', String(limit));
        if (skip != null) params.append('skip', String(skip));
        if (sort) params.append('sort', JSON.stringify(sort));
        if (identifier?.trim()) params.append('identifier', identifier.trim());
        if (action != null) {
          const actions = Array.isArray(action) ? action : [action];
          actions.forEach((a) => params.append('action', String(a)));
        }
        const beginIso = toIsoString(begin);
        const endIso = toIsoString(end);
        if (beginIso) params.append('begin', beginIso);
        if (endIso) params.append('end', endIso);
        resource?.forEach((value) => params.append('resource', value));
        documentId?.forEach((value) => params.append('documentId', value));

        const qs = params.toString();
        return qs ? `/activity?${qs}` : `/activity`;
      },
      transformResponse: (response: Activity[] | ActivityListResponse) =>
        Array.isArray(response) ? response : response.data ?? [],
      providesTags: (result) =>
        result?.length
          ? [
              ...result.map((item) => ({ type: ACTIVITY_TAG, id: idOf(item) })),
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
