import styles from "./Bucket.module.scss";
import {useBucket} from "../../contexts/BucketContext";
import {useParams} from "react-router-dom";
import BucketTable, {type ColumnType} from "../../components/organisms/bucket-table/BucketTable";
import {useCallback, useEffect, useMemo, useState} from "react";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";
import type {BucketDataQueryType} from "src/services/bucketService";

export default function Bucket() {
  const [lastSearchedText, setLastSearchedText] = useState<string | null>(null);
  const {bucketId} = useParams<{bucketId: string}>();
  const {buckets, bucketData, getBucketData, nextbucketDataQuery, bucketDataLoading} = useBucket();

  useEffect(() => {
    if (!bucketId) return;
    getBucketData(bucketId);
  }, [bucketId]);

  const formattedColumns: ColumnType[] = useMemo(() => {
    const bucket = buckets?.find(i => i._id === bucketId);
    const columns = Object.values(bucket?.properties ?? {});
    return [
      {
        header: "_id",
        key: "_id",
        showDropdownIcon: true,
        sticky: true,
        width: "230px",
        resizable: false,
        fixed: true,
        selectable: false
      },
      ...columns.map(i => ({
        ...i,
        header: i.title,
        key: i.title,
        showDropdownIcon: true
      }))
    ] as ColumnType[];
  }, [buckets, bucketId]);

  const handleScrollEnd = useCallback(() => {
    if (!bucketId) return;
    const query = nextbucketDataQuery;
    if (query?.bucketId) {
      delete (query as any).bucketId;
    }
    getBucketData(bucketId, query as BucketDataQueryType);
  }, [bucketId, getBucketData, nextbucketDataQuery]);

  const searchableColumns = formattedColumns
    .filter(i => i.type === "string" || i.type === "textarea" || i.type === "richtext")
    .map(i => i.key);

  const handleSearch = useCallback(
    (search: string) => {
      if (!search.length && lastSearchedText) {
        setLastSearchedText(null);
        getBucketData(bucketId as string, undefined, true);
        return;
      }
      const query = {
        paginatie: true,
        relation: true,
        limit: 25,
        filter: JSON.stringify({
          $or: searchableColumns.map(i => ({[i]: {$regex: search, $options: "i"}}))
        })
      };
      getBucketData(bucketId as string, query as BucketDataQueryType, true);
      setLastSearchedText(search);
    },
    [bucketId, searchableColumns]
  );

  return (
    <div className={styles.container}>
      <BucketActionBar bucketId={bucketId as string} search={handleSearch} />
      <BucketTable
        bucketId={bucketId as string}
        columns={formattedColumns}
        data={bucketData?.data ?? []}
        onScrollEnd={handleScrollEnd}
        totalDataLength={bucketData?.meta?.total ?? 0}
        maxHeight="88vh"
        loading={
          !(formattedColumns.length > 1 && nextbucketDataQuery?.bucketId === bucketId) ||
          bucketDataLoading
        }
      />
    </div>
  );
}
