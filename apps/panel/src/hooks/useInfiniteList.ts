import { useCallback, useEffect, useState } from "react";

interface PaginatedResponse<T> {
  data: T[];
  meta?: { total: number };
}

interface UseInfiniteListOptions<T> {
  response: PaginatedResponse<T> | undefined;
  isFetching: boolean;
  pageSize: number;
  idKey?: keyof T;
}

interface UseInfiniteListReturn<T> {
  allItems: T[];
  skip: number;
  totalCount: number;
  hasMore: boolean;
  handleLoadMore: () => void;
  resetList: () => void;
}

export function useInfiniteList<T extends { _id?: string }>({
  response,
  isFetching,
  pageSize,
}: UseInfiniteListOptions<T>): UseInfiniteListReturn<T> {
  const [skip, setSkip] = useState(0);
  const [allItems, setAllItems] = useState<T[]>([]);

  useEffect(() => {
    if (!response?.data) return;
    if (skip === 0) {
      setAllItems(response.data);
    } else {
      setAllItems((prev) => {
        const existingIds = new Set(prev.map((item) => item._id));
        const newItems = response.data.filter((item) => !existingIds.has(item._id));
        return [...prev, ...newItems];
      });
    }
  }, [response, skip]);

  const totalCount = response?.meta?.total ?? 0;
  const hasMore = allItems.length < totalCount;

  const handleLoadMore = useCallback(() => {
    if (!isFetching) {
      setSkip((prev) => prev + pageSize);
    }
  }, [isFetching, pageSize]);

  const resetList = useCallback(() => {
    setSkip(0);
    setAllItems([]);
  }, []);

  return { allItems, skip, totalCount, hasMore, handleLoadMore, resetList };
}
