import styles from "./Bucket.module.scss";
import {useBucket} from "../../contexts/BucketContext";
import {useParams} from "react-router-dom";
import BucketTable, {type ColumnType} from "../../components/organisms/bucket-table/BucketTable";
import {useEffect, useMemo} from "react";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";
import type {BucketDataQueryType} from "src/services/bucketService";

export default function Bucket() {
  const {bucketId} = useParams<{bucketId: string}>();
  const {buckets, bucketData, getBucketData, nextbucketDataQuery} = useBucket();

  useEffect(() => {
    if (!bucketId) return;
    getBucketData(bucketId);
  }, [bucketId]);

  const formattedColumns = useMemo(() => {
    const bucket = buckets?.find(i => i._id === bucketId);
    const columns = Object.values(bucket?.properties ?? {});
    return [
      {
        header: "_id",
        key: "_id",
        type: "string",
        showDropdownIcon: true
      },
      ...columns.map(i => ({
        ...i,
        header: i.title,
        key: i.title,
        showDropdownIcon: true
      }))
    ];
  }, [buckets, bucketId]);
  return (
    <div className={styles.container}>
      <BucketActionBar />
      <BucketTable
        bucketId={bucketId as string}
        columns={formattedColumns as ColumnType[]}
        data={bucketData?.data ?? []}
        onScrollEnd={() => {
          if (!bucketId) return;
          const query = nextbucketDataQuery;
          if (query?.bucketId) {
            delete (query as any).bucketId;
          }
          getBucketData(bucketId, query as BucketDataQueryType);
        }}
        totalDataLength={bucketData?.meta?.total ?? 0}
        maxHeight="70vh"
      />
    </div>
  );
}
