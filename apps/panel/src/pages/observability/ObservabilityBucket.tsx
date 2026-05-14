import React, {useState, useCallback, useMemo, useEffect} from "react";
import {skipToken} from "@reduxjs/toolkit/query/react";
import {FlexElement, Select, Text} from "oziko-ui-kit";
import {useGetBucketsQuery, useGetBucketDataProfileQuery} from "../../store/api/bucketApi";
import ProfilerTable from "../../components/organisms/profiler-table/ProfilerTable";
import {useProfilerInfiniteList} from "../../hooks/useProfilerInfiniteList";
import {createProfilerFilterDefaultValues} from "../../utils/profilerFilter";

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
    <FlexElement direction="vertical" gap={12} dimensionX="fill" alignment="leftCenter">
      <FlexElement direction="horizontal" gap={8} alignment="leftCenter">
        <Text size="medium">Bucket</Text>
        <Select
          options={bucketOptions}
          value={bucketId}
          onChange={handleBucketChange}
          placeholder="Select a bucket…"
          dimensionX="fill"
          style={{maxWidth: "320px"}}
        />
      </FlexElement>

      <ProfilerTable
        title="Bucket Profiler"
        subtitle={bucketId ? `— MongoDB profiler entries for ${selectedBucketTitle}` : "— Select a bucket to filter profiler data"}
        entries={profiler.allEntries}
        isLoading={isLoading && profiler.skip === 0}
        isFetching={isFetching}
        hasMore={profiler.hasMore}
        onLoadMore={profiler.handleLoadMore}
        scrollContainerId="bucket-profiler-scroll"
        filter={profiler.filter}
        sortOrder={profiler.sortOrder}
        onFilterChange={profiler.handleFilterChange}
        onToggleSort={profiler.handleToggleSort}
        onRefetch={refetch}
      />
    </FlexElement>
  );
};

export default ObservabilityBucket;
