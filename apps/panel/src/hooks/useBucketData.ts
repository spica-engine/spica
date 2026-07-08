import {useState, useCallback, useMemo, useRef, useEffect} from "react";
import {
  useGetBucketDataQuery,
  useGetBucketQuery,
  useLazyGetBucketDataQuery
} from "../store/api/bucketApi";
import type {BucketDataQueryType} from "../store/api/bucketApi";
import useLocalStorage from "./useLocalStorage";
import {
  computeRelationParam,
  getRelationFieldKeys,
  relationLabelModeMapKey,
  seedRelationLabelMap,
  type RelationLabelModeMap
} from "../components/prefabs/relation-picker/primaryFieldUtils";

const DEFAULT_PAGE_SIZE = 25;

export interface RelationQueryParam {
  relation: boolean | string[] | undefined;
  // The `relation` arg can only be trusted once the bucket schema has settled;
  // `undefined` before that is "unknown", not "omit". Callers gate the list
  // query on `ready` so it fires exactly once with the correct resolution scope.
  ready: boolean;
}

// Resolves the `relation` query arg for a viewed bucket from its relation fields
// and their per-field label config. Reactive: the localStorage map broadcasts
// updates, so flipping a field id/primary recomputes here and the RTK cache key
// changes, refetching with the right resolution scope.
export function useRelationQueryParam(bucketId?: string): RelationQueryParam {
  const {data: bucket, isSuccess, isError} = useGetBucketQuery(bucketId as string, {
    skip: !bucketId
  });
  const [labelMap] = useLocalStorage<RelationLabelModeMap>(
    relationLabelModeMapKey(bucketId ?? ""),
    {}
  );

  const relation = useMemo(() => {
    const relationFieldKeys = getRelationFieldKeys(bucket?.properties);
    // Honor the deprecated per-bucket setting for fields the new per-field map
    // doesn't cover, so a bucket configured "id" (legacy) isn't silently treated
    // as "primary" and over-resolved. Explicit per-field entries still win.
    const effectiveMap = {
      ...seedRelationLabelMap(bucketId ?? "", relationFieldKeys),
      ...labelMap
    };
    return computeRelationParam(relationFieldKeys, effectiveMap);
  }, [bucket?.properties, labelMap, bucketId]);

  // No bucket means the list query is skipped anyway; otherwise wait for the
  // schema fetch to settle (success or error) before the param is trustworthy.
  const ready = !bucketId || isSuccess || isError;

  return {relation, ready};
}

function smoothScrollToTop(el: HTMLElement): Promise<void> {
  return new Promise(resolve => {
    if (!el) {
      resolve();
      return;
    }

    if (el.scrollTop === 0) {
      resolve();
      return;
    }

    const onScroll = () => {
      if (el.scrollTop === 0) {
        el.removeEventListener("scroll", onScroll);
        resolve();
      }
    };

    el.addEventListener("scroll", onScroll);

    el.scrollTo({top: 0, behavior: "smooth"});
  });
}

function dedupeById(rows: any[]): any[] {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const row of rows) {
    const id = row?._id;
    const key = typeof id === "string" ? id : JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

export interface UseBucketDataResult {
  bucketData: {
    data: any[];
    meta: {total: number};
    bucketId: string;
  } | null;
  bucketDataLoading: boolean;
  refreshLoading: boolean;
  tableRef: React.MutableRefObject<HTMLElement | null>;
  handleRefresh: () => Promise<any>;
  loadMore: () => void;
  hasMore: boolean;
  isFetchingMore: boolean;
}

export interface UseBucketDataOptions {
  // When false the RTK query is skipped so the hook stays inert while another
  // retrieval strategy (realtime) drives the table. Hooks can't be conditional,
  // so the caller mounts both and disables the one it isn't using.
  enabled?: boolean;
}

export function useBucketData(
  bucketId: string,
  searchQuery: BucketDataQueryType | undefined,
  options?: UseBucketDataOptions
): UseBucketDataResult {
  const enabled = options?.enabled !== false;
  const resolvedBucketId =
    typeof bucketId === "string" && bucketId.trim() !== "" && bucketId !== "undefined" && bucketId !== "null"
      ? bucketId
      : undefined;

  const queryArgs = useMemo(() => {
    if (!resolvedBucketId) {
      return undefined;
    }

    // `relation` is intentionally not defaulted here: the strategy layer injects
    // the optimized value (true / field list / omitted) via searchQuery.
    return {
      bucketId: resolvedBucketId,
      paginate: true,
      limit: DEFAULT_PAGE_SIZE,
      sort: {_id: -1},
      ...searchQuery,
    };
  }, [resolvedBucketId, searchQuery]);

  const pageSize = (queryArgs?.limit as number) ?? DEFAULT_PAGE_SIZE;

  const {
    data: bucketDataResponse,
    isLoading: bucketDataLoading,
    refetch: refreshBucketData
  } = useGetBucketDataQuery(
    queryArgs as NonNullable<typeof queryArgs>,
    {
      skip: !queryArgs || !enabled,
      refetchOnFocus: true
    }
  );

  // Pages loaded beyond the first page via "load more". Reset whenever the
  // first page reloads (filter/sort/search change, refetch, or cache invalidation
  // after create/delete) so we never show stale or duplicated rows.
  const [extraData, setExtraData] = useState<any[]>([]);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [fetchMore] = useLazyGetBucketDataQuery();

  useEffect(() => {
    setExtraData([]);
  }, [bucketDataResponse]);

  const firstPage = bucketDataResponse?.data ?? [];
  const total = bucketDataResponse?.meta?.total ?? 0;

  const combinedData = useMemo(
    () => dedupeById([...firstPage, ...extraData]),
    [firstPage, extraData]
  );

  const hasMore = !!queryArgs && combinedData.length < total;

  const bucketData = bucketDataResponse
    ? {
        data: combinedData,
        meta: bucketDataResponse.meta,
        bucketId: resolvedBucketId!
      }
    : null;

  const [refreshLoading, setRefreshLoading] = useState(false);
  const tableRef = useRef<HTMLElement | null>(null);

  const loadMore = useCallback(() => {
    if (!queryArgs || isFetchingMore || combinedData.length >= total) {
      return;
    }

    setIsFetchingMore(true);
    fetchMore({...queryArgs, skip: combinedData.length, limit: pageSize})
      .unwrap()
      .then(page => {
        const rows = page?.data ?? [];
        if (rows.length) {
          setExtraData(prev => dedupeById([...prev, ...rows]));
        }
      })
      .catch(() => {
        // Swallow — the next scroll will retry; the first page is still shown.
      })
      .finally(() => setIsFetchingMore(false));
  }, [queryArgs, isFetchingMore, combinedData.length, total, fetchMore, pageSize]);

  const handleRefresh = useCallback(async () => {
    if (tableRef.current) await smoothScrollToTop(tableRef.current);
    setRefreshLoading(true);
    setExtraData([]);
    const result = await refreshBucketData();
    setRefreshLoading(false);
    return result;
  }, [refreshBucketData]);

  return {
    bucketData,
    bucketDataLoading,
    refreshLoading,
    tableRef,
    handleRefresh,
    loadMore,
    hasMore,
    isFetchingMore
  };
}
