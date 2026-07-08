import React, {useCallback, useMemo} from "react";
import {Text} from "oziko-ui-kit";
import {useGetBucketsQuery} from "../../store/api/bucketApi";
import type {BucketType} from "../../store/api/bucketApi";
import Page from "../../components/organisms/page-layout/Page";
import useLocalStorage from "../../hooks/useLocalStorage";
import {
  bucketDataStrategyKey,
  type BucketDataStrategy
} from "../../hooks/useBucketDataStrategy";
import {
  getRelationFieldKeys,
  relationLabelModeMapKey,
  resolveRelationFieldMode,
  seedRelationLabelMap,
  type RelationLabelMode,
  type RelationLabelModeMap
} from "../../components/prefabs/relation-picker/primaryFieldUtils";
import styles from "./DataStrategy.module.scss";

type RelationFieldToggleProps = {
  fieldKey: string;
  title: string;
  mode: RelationLabelMode;
  onChange: (fieldKey: string, mode: RelationLabelMode) => void;
};

const RelationFieldToggle: React.FC<RelationFieldToggleProps> = React.memo(
  ({fieldKey, title, mode, onChange}) => {
    const selectId = useCallback(() => onChange(fieldKey, "id"), [fieldKey, onChange]);
    const selectPrimary = useCallback(
      () => onChange(fieldKey, "primary"),
      [fieldKey, onChange]
    );

    return (
      <div className={styles.relationField}>
        <span className={styles.fieldName}>{title}</span>
        <div className={styles.segmented} role="group">
          <button
            type="button"
            className={mode === "id" ? styles.active : ""}
            onClick={selectId}
          >
            ID
          </button>
          <button
            type="button"
            className={mode === "primary" ? styles.active : ""}
            onClick={selectPrimary}
          >
            Primary
          </button>
        </div>
      </div>
    );
  }
);

RelationFieldToggle.displayName = "RelationFieldToggle";

type StrategyRowProps = {
  bucket: BucketType;
};

const StrategyRow: React.FC<StrategyRowProps> = React.memo(({bucket}) => {
  const [strategy, setStrategy] = useLocalStorage<BucketDataStrategy>(
    bucketDataStrategyKey(bucket._id),
    "http"
  );

  const relationFieldKeys = useMemo(
    () => getRelationFieldKeys(bucket.properties),
    [bucket.properties]
  );

  // Buckets that had the deprecated single-value setting pre-fill every relation
  // field with that choice; otherwise each field defaults to "primary".
  const initialLabelMap = useMemo(
    () => seedRelationLabelMap(bucket._id, relationFieldKeys),
    [bucket._id, relationFieldKeys]
  );

  const [labelMap, setLabelMap] = useLocalStorage<RelationLabelModeMap>(
    relationLabelModeMapKey(bucket._id),
    initialLabelMap
  );

  const selectHttp = useCallback(() => setStrategy("http"), [setStrategy]);
  const selectRealtime = useCallback(() => setStrategy("realtime"), [setStrategy]);

  const setFieldMode = useCallback(
    (fieldKey: string, mode: RelationLabelMode) => {
      setLabelMap({...labelMap, [fieldKey]: mode});
    },
    [labelMap, setLabelMap]
  );

  return (
    <tr className={styles.row}>
      <td className={styles.name}>{bucket.title}</td>
      <td className={styles.strategy}>
        <div className={styles.segmented} role="group">
          <button
            type="button"
            className={strategy === "http" ? styles.active : ""}
            onClick={selectHttp}
          >
            HTTP
          </button>
          <button
            type="button"
            className={strategy === "realtime" ? styles.active : ""}
            onClick={selectRealtime}
          >
            Realtime
          </button>
        </div>
      </td>
      <td className={styles.relationLabel}>
        {relationFieldKeys.length > 0 && (
          <div className={styles.relationFields}>
            {relationFieldKeys.map(fieldKey => (
              <RelationFieldToggle
                key={fieldKey}
                fieldKey={fieldKey}
                title={bucket.properties[fieldKey]?.title ?? fieldKey}
                mode={resolveRelationFieldMode(labelMap, fieldKey)}
                onChange={setFieldMode}
              />
            ))}
          </div>
        )}
      </td>
    </tr>
  );
});

StrategyRow.displayName = "StrategyRow";

const DataStrategy = () => {
  const {data: buckets = [], isLoading} = useGetBucketsQuery();

  return (
    <Page title="DATA RETRIEVAL STRATEGY">
      <div className={styles.dataStrategy}>
        <Text className={styles.description}>
          Choose how each bucket loads its data: HTTP fetches on demand, Realtime streams
          live over a WebSocket.
        </Text>

        {isLoading && <Text>Loading buckets…</Text>}

        {!isLoading && buckets.length === 0 && <Text>No buckets available.</Text>}

        {!isLoading && buckets.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Strategy</th>
                <th>Relation label</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map(bucket => (
                <StrategyRow key={bucket._id} bucket={bucket} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Page>
  );
};

export default DataStrategy;
