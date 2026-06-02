import {useState, useCallback, useMemo, useRef, useEffect} from "react";
import {useGetBucketDataQuery, useLazyGetBucketDataQuery} from "../store/api/bucketApi";
import type {BucketDataQueryType} from "../store/api/bucketApi";

const DEFAULT_PAGE_SIZE = 25;

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

interface UseBucketDataResult {
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

export function useBucketData(
  bucketId: string,
  searchQuery: BucketDataQueryType | undefined
): UseBucketDataResult {
  const resolvedBucketId =
    typeof bucketId === "string" && bucketId.trim() !== "" && bucketId !== "undefined" && bucketId !== "null"
      ? bucketId
      : undefined;

  const queryArgs = useMemo(() => {
    if (!resolvedBucketId) {
      return undefined;
    }

    return {
      bucketId: resolvedBucketId,
      paginate: true,
      relation: true,
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
      skip: !queryArgs,
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
