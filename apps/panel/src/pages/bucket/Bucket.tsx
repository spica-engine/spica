import styles from "./Bucket.module.scss";
import {useBucket} from "../../contexts/BucketContext";
import {useParams} from "react-router-dom";
import BucketTable, {type ColumnType} from "../../components/organisms/bucket-table/BucketTable";
import {useCallback, useEffect, useMemo, useReducer, useRef, useState} from "react";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";
import type {BucketDataQueryWithIdType, BucketType} from "src/services/bucketService";

const escapeForRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const buildBucketQuery = (searchText: string, searchableColumns: string[]) =>
  ({
    paginate: true,
    relation: true,
    limit: 25,
    filter: JSON.stringify({
      $or: searchableColumns.map(col => ({
        [col]: {$regex: escapeForRegex(searchText), $options: "i"}
      }))
    })
  }) as const;

function smoothScrollToTop(el: HTMLElement): Promise<void> {
  return new Promise(resolve => {
    if (!el) {
      resolve();
      return;
    }

    if (el.scrollTop === 0) {
      resolve();
      return;
    }

    const onScroll = () => {
      if (el.scrollTop === 0) {
        el.removeEventListener("scroll", onScroll);
        resolve();
      }
    };

    el.addEventListener("scroll", onScroll);

    el.scrollTo({top: 0, behavior: "smooth"});
  });
}

export default function Bucket() {
  const [refreshLoading, setRefreshLoading] = useState(false);
  const {bucketId} = useParams<{bucketId: string}>();
  const {
    buckets,
    bucketData,
    getBucketData,
    loadMoreBucketData,
    bucketDataLoading,
    refreshBucketData,
    updateCellData
  } = useBucket();

  useEffect(() => {
    if (!bucketId) return;
    getBucketData(bucketId);
  }, [bucketId]);

  const bucket = useMemo(() => buckets?.find(i => i._id === bucketId), [buckets, bucketId]);

  const formattedColumns: ColumnType[] = useMemo(() => {
    const calculatedBucketId = bucketData?.bucketId ?? (bucketId as string);
    const bucket = buckets?.find(i => i._id === calculatedBucketId);
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
      ...columns.map(i => ({...i, header: i.title, key: i.title, showDropdownIcon: true}))
    ] as ColumnType[];
  }, [buckets, bucketId, bucketData?.bucketId]);

  const searchableColumns = formattedColumns
    .filter(({type}) => ["string", "textarea", "richtext"].includes(type as string))
    .map(({key}) => key);

  const handleSearch = useCallback(
    async (search: string) => {
      const trimmed = search.trim();
      const query = trimmed === "" ? undefined : buildBucketQuery(trimmed, searchableColumns);
      await getBucketData(bucketId as string, query as unknown as BucketDataQueryWithIdType);
    },
    [bucketId, searchableColumns, getBucketData]
  );

  const isTableLoading = useMemo(() => !(formattedColumns.length > 1), [formattedColumns]);

  const tableRef = useRef<HTMLElement | null>(null);

  const handleRefresh = useCallback(async () => {
    if (tableRef.current) await smoothScrollToTop(tableRef.current);
    setRefreshLoading(true);
    await refreshBucketData();
    setRefreshLoading(false);
  }, [bucketId, refreshBucketData]);


  const handleCellSave = (value: any, columnName: string, rowId: string) => {
    updateCellData(value, columnName, rowId)
  }

  return (
    <div className={styles.container}>
      <BucketActionBar
        bucket={bucket as BucketType}
        onSearch={handleSearch}
        onRefresh={handleRefresh}
        searchLoading={bucketDataLoading && !isTableLoading}
        refreshLoading={refreshLoading}
      />
      <BucketTable
        bucketId={bucketId as string}
        columns={formattedColumns}
        data={bucketData?.data ?? []}
        onScrollEnd={loadMoreBucketData}
        totalDataLength={bucketData?.meta?.total ?? 0}
        maxHeight="88vh"
        loading={isTableLoading}
        tableRef={tableRef}
        onCellSave={handleCellSave}
      />
    </div>
  );
}
