import styles from "./Bucket.module.scss";
import {useBucket} from "../../contexts/BucketContext";
import {useParams} from "react-router-dom";
import BucketTable, {type ColumnType} from "../../components/organisms/bucket-table/BucketTable";
import {useEffect} from "react";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";

export default function Bucket() {
  const {bucketId} = useParams<{bucketId: string}>();
  const {buckets, bucketData, getBucketData, nextbucketDataQuery} = useBucket();

  useEffect(() => {
    if (!bucketId) return;
    getBucketData(bucketId);
  }, [bucketId]);

  const bucket = buckets?.find(i => i._id === bucketId);
  const columns = Object.values(bucket?.properties ?? {});
  const formattedColumns = [
    {
      header: "_id",
      key: "_id",
      type: "string",
      width: "30px",
      showDropdownIcon: true
    },
    ...columns.map(i => ({
      ...i,
      header: i.title,
      key: i.title,
      width: "30px",
      showDropdownIcon: true
    }))
  ];

  return (
    <div className={styles.container}>
      <BucketActionBar />
      <BucketTable
        columns={formattedColumns as ColumnType[]}
        data={bucketData?.data ?? []}
        onScrollEnd={() => {
          if (!bucketId) return;
          getBucketData(bucketId, nextbucketDataQuery);
        }}
        totalDataLength={bucketData?.meta.total ?? 0}
        maxHeight="70vh"
      />
    </div>
  );
}
