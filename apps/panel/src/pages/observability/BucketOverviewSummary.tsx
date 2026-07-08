import React, {memo} from "react";
import HealthPill from "./HealthPill";
import {type BucketHealthStatus} from "./bucketHealth";
import styles from "./Observability.module.scss";

type BucketOverviewSummaryProps = {
  totalBuckets: number;
  totalEntities: number;
  countedBuckets: number;
  healthCounts: Record<BucketHealthStatus, number>;
};

const BucketOverviewSummary = ({
  totalBuckets,
  totalEntities,
  countedBuckets,
  healthCounts,
}: BucketOverviewSummaryProps) => {
  const stillLoading = countedBuckets < totalBuckets;

  return (
    <div className={styles.overviewSummary}>
      <div className={styles.metric}>
        <span className={styles.metricValue}>{totalBuckets}</span>
        <span className={styles.metricLabel}>Buckets</span>
      </div>

      <div className={styles.metric}>
        <span className={styles.metricValue}>
          {totalEntities.toLocaleString()}
          {stillLoading ? "+" : ""}
        </span>
        <span className={styles.metricLabel}>Total Entities</span>
      </div>

      <div className={styles.metric}>
        <span className={styles.metricLabel}>Health</span>
        <div className={styles.healthBreakdown}>
          {(["critical", "attention", "healthy"] as BucketHealthStatus[]).map(status =>
            healthCounts[status] > 0 ? (
              <span key={status} className={styles.entityCount}>
                <HealthPill status={status} />
                {healthCounts[status]}
              </span>
            ) : null
          )}
          {countedBuckets === 0 && <span className={styles.metricValue}>—</span>}
        </div>
      </div>
    </div>
  );
};

export default memo(BucketOverviewSummary);
