import React, {useCallback, useMemo, useState} from "react";
import {Button, FlexElement, Icon, Table, type TableColumn} from "oziko-ui-kit";
import type {BucketType} from "../../store/api/bucketApi";
import EntityCountCell from "./EntityCountCell";
import HealthPill from "./HealthPill";
import BucketOverviewSummary from "./BucketOverviewSummary";
import {
  deriveBucketHealth,
  healthReason,
  type BucketHealthStatus,
} from "./bucketHealth";
import styles from "./Observability.module.scss";

type BucketOverviewListProps = {
  buckets: BucketType[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectBucket: (bucketId: string) => void;
};

const EMPTY_HEALTH: Record<BucketHealthStatus, number> = {
  healthy: 0,
  attention: 0,
  critical: 0,
};

const BucketOverviewList = ({
  buckets,
  isLoading,
  isError,
  onRetry,
  onSelectBucket,
}: BucketOverviewListProps) => {
  // Per-bucket entity counts lifted from each row's lazy query, so the summary
  // strip can aggregate totals + health without a second round of requests.
  const [counts, setCounts] = useState<Record<string, number>>({});

  const handleCount = useCallback((bucketId: string, total: number) => {
    setCounts(prev => (prev[bucketId] === total ? prev : {...prev, [bucketId]: total}));
  }, []);

  const summary = useMemo(() => {
    let totalEntities = 0;
    let countedBuckets = 0;
    const healthCounts: Record<BucketHealthStatus, number> = {...EMPTY_HEALTH};

    for (const bucket of buckets) {
      const count = counts[bucket._id];
      if (typeof count !== "number") continue;
      countedBuckets += 1;
      totalEntities += count;
      healthCounts[deriveBucketHealth(count, bucket)] += 1;
    }

    return {totalEntities, countedBuckets, healthCounts};
  }, [buckets, counts]);

  const columns: TableColumn<BucketType>[] = useMemo(
    () => [
      {
        header: <FlexElement>Bucket</FlexElement>,
        key: "title",
        width: "320px",
        minWidth: "200px",
        renderCell: ({row}) => (
          <FlexElement direction="horizontal" gap={8} alignment="leftCenter">
            <Icon name="bucket" size={16} />
            <span>{row.title}</span>
          </FlexElement>
        ),
      },
      {
        header: <FlexElement>Entities</FlexElement>,
        key: "entities",
        width: "160px",
        minWidth: "120px",
        renderCell: ({row}) => (
          <EntityCountCell bucketId={row._id} onCount={handleCount} />
        ),
      },
      {
        header: <FlexElement>Health</FlexElement>,
        key: "health",
        width: "180px",
        minWidth: "140px",
        renderCell: ({row}) => {
          const count = counts[row._id];
          if (typeof count !== "number") return <HealthPill status="healthy" loading />;
          const status = deriveBucketHealth(count, row);
          return <HealthPill status={status} title={healthReason(count, row)} />;
        },
      },
      {
        header: (
          <FlexElement dimensionX="fill" alignment="rightCenter" direction="horizontal">
            Profiler
          </FlexElement>
        ),
        key: "actions",
        width: "120px",
        minWidth: "100px",
        renderCell: ({row}) => (
          <FlexElement dimensionX="fill" alignment="rightCenter" direction="horizontal">
            <Button variant="icon" color="default" onClick={() => onSelectBucket(row._id)}>
              <Icon name="chevronRight" />
            </Button>
          </FlexElement>
        ),
      },
    ],
    [counts, handleCount, onSelectBucket]
  );

  return (
    <div className={styles.bucketOverview}>
      <div className={styles.header}>
        <Icon name="filterCenterFocus" size={18} />
        <span className={styles.title}>Bucket Observability</span>
        <FlexElement dimensionX="fill" alignment="rightCenter" direction="horizontal">
          <Button
            shape="chip"
            variant="outlined"
            color="default"
            onClick={onRetry}
            disabled={isLoading}
          >
            <Icon name="refresh" size={16} />
          </Button>
        </FlexElement>
      </div>

      {!isLoading && !isError && buckets.length > 0 && (
        <BucketOverviewSummary
          totalBuckets={buckets.length}
          totalEntities={summary.totalEntities}
          countedBuckets={summary.countedBuckets}
          healthCounts={summary.healthCounts}
        />
      )}

      <div className={styles.body}>
        {isError ? (
          <div className={styles.stateMessage}>
            <Icon name="alertCircleOutline" size={28} />
            <span className={styles.stateTitle}>Failed to load buckets</span>
            <span className={styles.stateHint}>
              The bucket list request did not complete. The server may be unreachable.
            </span>
            <Button onClick={onRetry}>
              <Icon name="refresh" size={14} />
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={buckets}
            loading={isLoading}
            skeletonRowCount={8}
            onRowClick={({row}) => onSelectBucket(row._id)}
            emptyState={{
              title: "No buckets",
              description: "There are no buckets to observe yet. Create one to get started.",
            }}
          />
        )}
      </div>
    </div>
  );
};

export default BucketOverviewList;
