import React, {memo, useEffect} from "react";
import {Spinner} from "oziko-ui-kit";
import {useGetBucketDataQuery} from "../../store/api/bucketApi";
import styles from "./Observability.module.scss";

type EntityCountCellProps = {
  bucketId: string;
  onCount: (bucketId: string, total: number) => void;
};

/**
 * Per-row lazy count. Each row owns its own `getBucketData` subscription with
 * `limit:1&paginate:true`, so the response is just `meta.total` plus a single
 * document — the cheapest way to read a collection size without a dedicated
 * backend route. RTK Query dedupes/caches by args, so re-renders don't refetch.
 * This is N requests for N buckets, but they run in parallel and each is tiny;
 * the count is lifted to the parent (for the summary strip) via `onCount`.
 */
const EntityCountCell = ({bucketId, onCount}: EntityCountCellProps) => {
  const {data, isLoading, isError} = useGetBucketDataQuery({
    bucketId,
    limit: 1,
    paginate: true,
  });

  const total = data?.meta?.total;

  useEffect(() => {
    if (typeof total === "number") onCount(bucketId, total);
  }, [bucketId, total, onCount]);

  if (isLoading) return <Spinner size="small" />;
  if (isError || typeof total !== "number") {
    return <span className={styles.muted}>—</span>;
  }

  return (
    <span className={styles.entityCount}>{total.toLocaleString()}</span>
  );
};

export default memo(EntityCountCell);
