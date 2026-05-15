import React, {useState, useCallback, useMemo, useEffect} from "react";
import {skipToken} from "@reduxjs/toolkit/query/react";
import {Select} from "oziko-ui-kit";
import {useGetBucketsQuery, useGetBucketDataProfileQuery} from "../../store/api/bucketApi";
import ProfilerTable from "../../components/organisms/profiler-table/ProfilerTable";
import {useProfilerInfiniteList} from "../../hooks/useProfilerInfiniteList";
import {createProfilerFilterDefaultValues} from "../../utils/profilerFilter";
import ObservabilityActionBar from "../../components/molecules/observability-action-bar/ObservabilityActionBar";
import bucketStyles from "../bucket/Bucket.module.scss";
import styles from "../shared/EntityPage.module.scss";

const PAGE_SIZE = 20;

const ObservabilityBucket = () => {
  const [bucketId, setBucketId] = useState<string | undefined>(undefined);
  const profiler = useProfilerInfiniteList(PAGE_SIZE);

  const {data: buckets = []} = useGetBucketsQuery();

  const bucketOptions = useMemo(
    () => buckets.map(b => ({label: b.title, value: b._id})),
    [buckets]
  );

  const {data, isLoading, isFetching, refetch} = useGetBucketDataProfileQuery(
    bucketId ? {...profiler.queryParams, bucketId} : skipToken,
    {refetchOnMountOrArgChange: true}
  );

  useEffect(() => {
    profiler.onQueryResult(data, isFetching, profiler.skip);
  }, [data, isFetching, profiler.skip]);

  const handleBucketChange = useCallback(
    (value: string | number | (string | number)[]) => {
      setBucketId(value as string);
      profiler.handleFilterChange(createProfilerFilterDefaultValues());
    },
    [profiler.handleFilterChange]
  );

  const selectedBucketTitle = useMemo(
    () => buckets.find(b => b._id === bucketId)?.title ?? bucketId,
    [buckets, bucketId]
  );

  return (
    <div className={bucketStyles.container}>
      <ObservabilityActionBar
        title="Bucket Profiler"
        subtitle={bucketId ? `— ${selectedBucketTitle}` : ""}
        filter={profiler.filter}
        isFetching={isFetching}
        onFilterChange={profiler.handleFilterChange}
        onRefetch={refetch}
      >
        <Select
          options={bucketOptions}
          value={bucketId}
          onChange={handleBucketChange}
          placeholder="Select a bucket…"
          style={{width: "220px"}}
        />
      </ObservabilityActionBar>

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
        />
      </div>
    </div>
  );
};

export default ObservabilityBucket;
