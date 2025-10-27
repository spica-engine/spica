import {useState, useCallback, useRef} from "react";
import {useGetBucketDataQuery} from "../store/api/bucketApi";
import type {BucketDataQueryWithIdType} from "../services/bucketService";

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
  searchQuery: BucketDataQueryWithIdType | undefined
): UseBucketDataResult {
  const {
    data: bucketDataResponse,
    isLoading: bucketDataLoading,
    refetch: refreshBucketData
  } = useGetBucketDataQuery(
    searchQuery || {
      bucketId: bucketId!,
      paginate: true,
      relation: true,
      limit: 25,
      sort: {_id: -1}
    },
    {
      skip: !bucketId,
      refetchOnMountOrArgChange: 10,
      refetchOnFocus: true
    }
  );

  const bucketData = bucketDataResponse
    ? {
        ...bucketDataResponse,
        bucketId: bucketId!
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


