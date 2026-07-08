import React, {useState, useCallback, useMemo, useEffect} from "react";
import {skipToken} from "@reduxjs/toolkit/query/react";
import {useGetBucketsQuery, useGetBucketDataProfileQuery} from "../../store/api/bucketApi";
import ProfilerTable from "../../components/organisms/profiler-table/ProfilerTable";
import {useProfilerInfiniteList} from "../../hooks/useProfilerInfiniteList";
import {createProfilerFilterDefaultValues} from "../../utils/profilerFilter";
import ObservabilityActionBar from "../../components/molecules/observability-action-bar/ObservabilityActionBar";
import BucketOverviewList from "./BucketOverviewList";
import bucketStyles from "../bucket/Bucket.module.scss";
import styles from "../shared/EntityPage.module.scss";

const PAGE_SIZE = 20;

const ObservabilityBucket = () => {
  // undefined -> default overview list; a value -> profiler drill-in for that bucket.
  const [bucketId, setBucketId] = useState<string | undefined>(undefined);
  const profiler = useProfilerInfiniteList(PAGE_SIZE);

  const {
    data: buckets = [],
    isLoading: bucketsLoading,
    isError: bucketsError,
    refetch: refetchBuckets,
  } = useGetBucketsQuery();

  const {data, isLoading, isFetching, isError, refetch} = useGetBucketDataProfileQuery(
    bucketId ? {...profiler.queryParams, bucketId} : skipToken,
    {refetchOnMountOrArgChange: true}
  );

  const emptyMessage = "Profiler is empty for this bucket";

  // When the profile endpoint returns [], the request still succeeded — the DB
  // simply has nothing to report (commonly because MongoDB profiling is disabled
  // on the server). Spell that out so an empty result is not mistaken for a
  // broken screen.
  const emptyHint =
    "The request succeeded but returned no entries. This bucket has no recorded operations yet, or database profiling is turned off on the server.";

  useEffect(() => {
    profiler.onQueryResult(data, isFetching, profiler.skip);
  }, [data, isFetching, profiler.skip]);

  const handleSelectBucket = useCallback(
    (value: string) => {
      setBucketId(value);
      profiler.handleFilterChange(createProfilerFilterDefaultValues());
    },
    [profiler.handleFilterChange]
  );

  const handleBack = useCallback(() => setBucketId(undefined), []);

  const selectedBucketTitle = useMemo(
    () => buckets.find(b => b._id === bucketId)?.title ?? bucketId,
    [buckets, bucketId]
  );

  if (!bucketId) {
    return (
      <div className={bucketStyles.container}>
        <BucketOverviewList
          buckets={buckets}
          isLoading={bucketsLoading}
          isError={bucketsError}
          onRetry={refetchBuckets}
          onSelectBucket={handleSelectBucket}
        />
      </div>
    );
  }

  return (
    <div className={bucketStyles.container}>
      <ObservabilityActionBar
        title="Bucket Profiler"
        subtitle={`— ${selectedBucketTitle}`}
        filter={profiler.filter}
        isFetching={isFetching}
        onFilterChange={profiler.handleFilterChange}
        onRefetch={refetch}
        onBack={handleBack}
      />

      <div className={styles.scrollContainer}>
        <ProfilerTable
          entries={profiler.allEntries}
          isLoading={isLoading && profiler.skip === 0}
          isFetching={isFetching}
          hasMore={profiler.hasMore}
          onLoadMore={profiler.handleLoadMore}
          scrollContainerId="bucket-profiler-scroll"
          sortOrder={profiler.sortOrder}
          onToggleSort={profiler.handleToggleSort}
          isError={isError}
          emptyMessage={emptyMessage}
          emptyHint={emptyHint}
        />
      </div>
    </div>
  );
};

export default ObservabilityBucket;
