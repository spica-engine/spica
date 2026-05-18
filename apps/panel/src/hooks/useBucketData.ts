import {useState, useCallback, useMemo, useRef} from "react";
import {useGetBucketDataQuery} from "../store/api/bucketApi";
import type {BucketDataQueryType} from "../store/api/bucketApi";

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
  loadMoreBucketData: () => Promise<void>;
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
      limit: 25,
      sort: {_id: -1},
      ...searchQuery,
    };
  }, [resolvedBucketId, searchQuery]);

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

  const bucketData = bucketDataResponse
    ? {
        ...bucketDataResponse,
        bucketId: resolvedBucketId!
      }
    : null;

  const [refreshLoading, setRefreshLoading] = useState(false);
  const tableRef = useRef<HTMLElement | null>(null);

  const loadMoreBucketData = useCallback(async () => {
    console.log("Load more data - implement pagination logic here");
  }, []);

  const handleRefresh = useCallback(async () => {
    if (tableRef.current) await smoothScrollToTop(tableRef.current);
    setRefreshLoading(true);
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
    loadMoreBucketData
  };
}


