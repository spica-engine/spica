import React, {useState, useCallback, useMemo} from "react";
import {skipToken} from "@reduxjs/toolkit/query/react";
import {FlexElement, Select, Text} from "oziko-ui-kit";
import {useGetBucketsQuery, useGetBucketDataProfileQuery} from "../../store/api/bucketApi";
import ProfilerTable from "../../components/organisms/profiler-table/ProfilerTable";
import pageStyles from "../shared/EntityPage.module.scss";

const PAGE_SIZE = 20;

const ObservabilityBucket = () => {
  const [bucketId, setBucketId] = useState<string | undefined>(undefined);
  const [skip, setSkip] = useState(0);
  const [opFilter, setOpFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<1 | -1>(-1);

  const {data: buckets = []} = useGetBucketsQuery();

  const bucketOptions = useMemo(
    () => buckets.map(b => ({label: b.title, value: b._id})),
    [buckets]
  );

  const {data: entries = [], isLoading, isFetching, refetch} = useGetBucketDataProfileQuery(
    bucketId
      ? {
          bucketId,
          limit: PAGE_SIZE,
          skip,
          sort: {ts: sortOrder},
          ...(opFilter ? {filter: {op: opFilter}} : {}),
        }
      : skipToken
  );

  const handleBucketChange = useCallback((value: string | number | (string | number)[]) => {
    setBucketId(value as string);
    setSkip(0);
    setOpFilter("");
  }, []);

  const handleFilterChange = useCallback((value: string) => {
    setOpFilter(value);
    setSkip(0);
  }, []);

  const handleToggleSort = useCallback(() => {
    setSortOrder(prev => (prev === -1 ? 1 : -1));
    setSkip(0);
  }, []);

  const selectedBucketTitle = useMemo(
    () => buckets.find(b => b._id === bucketId)?.title ?? bucketId,
    [buckets, bucketId]
  );

  return (
    <div className={pageStyles.pageContainer}>
      <FlexElement direction="vertical" gap={12} dimensionX="fill">
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

        {!bucketId ? (
          <FlexElement alignment="center" style={{padding: "48px 0", color: "var(--color-text-secondary)"}}>
            <Text size="medium">Select a bucket to view profiler data.</Text>
          </FlexElement>
        ) : (
          <ProfilerTable
            title="Bucket Profiler"
            subtitle={`— MongoDB profiler entries for ${selectedBucketTitle}`}
            entries={entries}
            isLoading={isLoading}
            isFetching={isFetching}
            skip={skip}
            pageSize={PAGE_SIZE}
            opFilter={opFilter}
            sortOrder={sortOrder}
            onFilterChange={handleFilterChange}
            onToggleSort={handleToggleSort}
            onRefetch={refetch}
            onPrevPage={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
            onNextPage={() => setSkip(skip + PAGE_SIZE)}
          />
        )}
      </FlexElement>
    </div>
  );
};

export default ObservabilityBucket;
