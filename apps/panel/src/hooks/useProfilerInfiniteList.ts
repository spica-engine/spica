import {useState, useCallback, useMemo} from "react";
import type {ProfilerEntry} from "../store/api/userApi";
import {
  buildProfilerFilterQuery,
  createProfilerFilterDefaultValues,
  type ProfilerFilterValues,
} from "../utils/profilerFilter";

export type ProfilerQueryParams = {
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
  filter?: Record<string, any>;
};

export function useProfilerInfiniteList(pageSize: number) {
  const [skip, setSkip] = useState(0);
  const [allEntries, setAllEntries] = useState<ProfilerEntry[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<ProfilerFilterValues>(createProfilerFilterDefaultValues());
  const [sortOrder, setSortOrder] = useState<1 | -1>(-1);

  const filterQuery = useMemo(() => buildProfilerFilterQuery(filter), [filter]);

  const queryParams = useMemo(
    (): ProfilerQueryParams => ({
      limit: pageSize,
      skip,
      sort: {ts: sortOrder},
      ...(filterQuery ? {filter: filterQuery} : {}),
    }),
    [pageSize, skip, sortOrder, filterQuery]
  );

  /**
   * Call this in a useEffect in the consuming component to accumulate pages.
   * Pass skip as a parameter so this callback stays stable (no skip in its deps).
   */
  const onQueryResult = useCallback(
    (data: ProfilerEntry[] | undefined, isFetching: boolean, currentSkip: number) => {
      if (isFetching || data === undefined) return;
      if (currentSkip === 0) {
        setAllEntries(data);
      } else {
        setAllEntries(prev => [...prev, ...data]);
      }
      setHasMore(data.length >= pageSize);
    },
    [pageSize]
  );

  const handleFilterChange = useCallback((value: ProfilerFilterValues) => {
    setFilter(value);
    setSkip(0);
    setAllEntries([]);
  }, []);

  const handleToggleSort = useCallback(() => {
    setSortOrder(prev => (prev === -1 ? 1 : -1));
    setSkip(0);
    setAllEntries([]);
  }, []);

  const handleLoadMore = useCallback(() => {
    setSkip(prev => prev + pageSize);
  }, [pageSize]);

  return {
    allEntries,
    hasMore,
    skip,
    queryParams,
    filter,
    sortOrder,
    onQueryResult,
    handleFilterChange,
    handleToggleSort,
    handleLoadMore,
  };
}
