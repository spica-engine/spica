import React, {memo, useMemo} from "react";
import type {SpicaFunction} from "../../../store/api/functionApi";
import type {BucketType} from "../../../store/api/bucketApi";
import {normalizeTriggers, describeTriggerOptions} from "../../../utils/functionTriggers";
import styles from "./FunctionTriggersList.module.scss";

type FunctionTriggersListProps = {
  functions: SpicaFunction[];
  buckets: BucketType[];
  isLoading?: boolean;
};

const TRIGGER_TYPE_CLASS: Record<string, string> = {
  http: styles.typeHttp,
  schedule: styles.typeSchedule,
  bucket: styles.typeBucket,
  database: styles.typeDatabase,
  firehose: styles.typeFirehose,
  system: styles.typeSystem
};

const FunctionTriggersList = ({functions, buckets, isLoading}: FunctionTriggersListProps) => {
  const bucketNameById = useMemo(
    () => new Map(buckets.map(bucket => [bucket._id, bucket.title])),
    [buckets]
  );

  if (isLoading) {
    return <div className={styles.triggersMessage}>Loading triggers…</div>;
  }

  if (functions.length === 0) {
    return <div className={styles.triggersMessage}>No functions yet. Create a function to document its triggers.</div>;
  }

  return (
    <div className={styles.functionTriggersList}>
      {functions.map(fn => {
        const triggers = normalizeTriggers(fn);
        return (
          <section key={fn._id} className={styles.group}>
            <header className={styles.groupHead}>
              <span className={styles.groupName}>{fn.name}</span>
              <span className={styles.groupCount}>{triggers.length}</span>
            </header>
            {triggers.length === 0 ? (
              <div className={styles.emptyRow}>No triggers configured.</div>
            ) : (
              <ul className={styles.triggerRows}>
                {triggers.map(trigger => {
                  const details = describeTriggerOptions(trigger).map(part =>
                    trigger.type === "bucket" && part.startsWith("bucket: ")
                      ? `bucket: ${bucketNameById.get(part.replace("bucket: ", "")) ?? part.replace("bucket: ", "")}`
                      : part
                  );
                  return (
                    <li key={trigger.name} className={styles.triggerRow}>
                      <span className={`${styles.typeBadge} ${TRIGGER_TYPE_CLASS[trigger.type] ?? ""}`}>
                        {trigger.type}
                      </span>
                      <span className={styles.triggerName}>{trigger.name}</span>
                      <span className={styles.triggerDetails}>{details.join(" · ") || "—"}</span>
                      <span className={trigger.active ? styles.stateActive : styles.stateInactive}>
                        {trigger.active ? "active" : "inactive"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default memo(FunctionTriggersList);
