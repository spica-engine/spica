import React, {useEffect} from "react";
import {useGetUserProfileQuery} from "../../store/api/userApi";
import ProfilerTable from "../../components/organisms/profiler-table/ProfilerTable";
import {useProfilerInfiniteList} from "../../hooks/useProfilerInfiniteList";

const PAGE_SIZE = 20;

const UserProfiler = () => {
  const profiler = useProfilerInfiniteList(PAGE_SIZE);
  const {data, isLoading, isFetching, refetch} = useGetUserProfileQuery(
    profiler.queryParams,
    {refetchOnMountOrArgChange: true}
  );

  useEffect(() => {
    profiler.onQueryResult(data, isFetching, profiler.skip);
  }, [data, isFetching, profiler.skip]);

  return (
    <ProfilerTable
      title="User Profiler"
      subtitle="— MongoDB profiler entries for the user collection"
      entries={profiler.allEntries}
      isLoading={isLoading && profiler.skip === 0}
      isFetching={isFetching}
      hasMore={profiler.hasMore}
      onLoadMore={profiler.handleLoadMore}
      scrollContainerId="user-profiler-scroll"
      filter={profiler.filter}
      sortOrder={profiler.sortOrder}
      onFilterChange={profiler.handleFilterChange}
      onToggleSort={profiler.handleToggleSort}
      onRefetch={refetch}
    />
  );
};

export default UserProfiler;
