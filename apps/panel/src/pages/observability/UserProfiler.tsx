import React, {useEffect} from "react";
import {useGetUserProfileQuery} from "../../store/api/userApi";
import ProfilerTable from "../../components/organisms/profiler-table/ProfilerTable";
import {useProfilerInfiniteList} from "../../hooks/useProfilerInfiniteList";
import ObservabilityActionBar from "../../components/molecules/observability-action-bar/ObservabilityActionBar";
import bucketStyles from "../bucket/Bucket.module.scss";
import styles from "../shared/EntityPage.module.scss";

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
    <div className={bucketStyles.container}>
      <ObservabilityActionBar
        title="User Profiler"
        subtitle="— MongoDB profiler entries for the user collection"
        filter={profiler.filter}
        isFetching={isFetching}
        onFilterChange={profiler.handleFilterChange}
        onRefetch={refetch}
      />

      <div className={styles.scrollContainer}>
        <ProfilerTable
          entries={profiler.allEntries}
          isLoading={isLoading && profiler.skip === 0}
          isFetching={isFetching}
          hasMore={profiler.hasMore}
          onLoadMore={profiler.handleLoadMore}
          scrollContainerId="user-profiler-scroll"
          sortOrder={profiler.sortOrder}
          onToggleSort={profiler.handleToggleSort}
        />
      </div>
    </div>
  );
};

export default UserProfiler;
