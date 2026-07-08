import React, {memo} from "react";
import {Spinner} from "oziko-ui-kit";
import {HEALTH_LABELS, type BucketHealthStatus} from "./bucketHealth";
import styles from "./Observability.module.scss";

type HealthPillProps = {
  status: BucketHealthStatus;
  loading?: boolean;
  title?: string;
};

const HealthPill = ({status, loading, title}: HealthPillProps) => {
  if (loading) {
    return <Spinner size="small" />;
  }

  return (
    <span className={`${styles.healthPill} ${styles[status]}`} title={title}>
      <span className={styles.dot} />
      {HEALTH_LABELS[status]}
    </span>
  );
};

export default memo(HealthPill);
