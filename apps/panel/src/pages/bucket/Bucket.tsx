import styles from "./Bucket.module.scss";
import {useBucket} from "../../contexts/BucketContext";
import {useParams} from "react-router-dom";
import BucketTable, {type ColumnType} from "../../components/organisms/bucket-table/BucketTable";
import {useCallback, useEffect, useMemo} from "react";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";
import type {BucketDataQueryWithIdType} from "src/services/bucketService";

const escapeForRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const buildBucketQuery = (searchText: string, searchableColumns: string[]) =>
  ({
    paginatie: true,
    relation: true,
    limit: 25,
    filter: JSON.stringify({
      $or: searchableColumns.map(col => ({
        [col]: {$regex: escapeForRegex(searchText), $options: "i"}
      }))
    })
  }) as const;

export default function Bucket() {
  const {bucketId} = useParams<{bucketId: string}>();
  const {
    buckets,
    bucketData,
    getBucketData,
    nextbucketDataQuery,
    bucketDataLoading,
    cleanBucketData
  } = useBucket();

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
    if (!bucketId || !nextbucketDataQuery) return;
    getBucketData(bucketId, nextbucketDataQuery);
  }, [bucketId, getBucketData, nextbucketDataQuery]);

  const searchableColumns = formattedColumns
    .filter(({type}) => ["string", "textarea", "richtext"].includes(type as string))
    .map(({key}) => key);

  const handleSearch = useCallback(
    async (search: string) => {
      const trimmed = search.trim();
      const query = trimmed === "" ? undefined : buildBucketQuery(trimmed, searchableColumns);
      await getBucketData(bucketId as string, query as unknown as BucketDataQueryWithIdType)
      cleanBucketData();
    },
    [bucketId, searchableColumns, getBucketData]
  );

  const isTableLoading = useMemo(() => !(formattedColumns.length > 1 && nextbucketDataQuery?.bucketId === bucketId), [
    formattedColumns,
    nextbucketDataQuery,
    bucketId
  ]);
  return (
    <div className={styles.container}>
      <BucketActionBar bucketId={bucketId as string} onSearch={handleSearch} searchLoading={bucketDataLoading && !isTableLoading} />
      <BucketTable
        bucketId={bucketId as string}
        columns={formattedColumns}
        data={bucketData?.data ?? []}
        onScrollEnd={handleScrollEnd}
        totalDataLength={bucketData?.meta?.total ?? 0}
        maxHeight="88vh"
        loading={isTableLoading}
      />
    </div>
  );
}
