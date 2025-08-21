import styles from "./Bucket.module.scss";
import {useBucket} from "../../contexts/BucketContext";
import {useParams} from "react-router-dom";
import BucketTable, {type ColumnType} from "../../components/organisms/bucket-table/BucketTable";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";
import type {BucketDataQueryWithIdType, BucketType} from "src/services/bucketService";
import useLocalStorage from "../../hooks/useLocalStorage";
import Loader from "../../components/atoms/loader/Loader";

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
    refreshBucketData
  } = useBucket();

  useEffect(() => {
    if (!bucketId) return;
    getBucketData(bucketId);
  }, [bucketId]);

  const bucket = useMemo(() => buckets?.find(i => i._id === bucketId), [buckets, bucketId]);

  const formattedColumns: ColumnType[] = useMemo(() => {
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
  }, [bucket]);

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

  if (formattedColumns.length <= 1 || !bucket) {
    return <Loader />;
  }

  return (
    <BucketWithVisibleColumns
      bucket={bucket}
      formattedColumns={formattedColumns as ColumnType[]}
      bucketData={bucketData}
      handleScrollEnd={loadMoreBucketData}
      bucketDataLoading={bucketDataLoading}
      isTableLoading={isTableLoading}
      handleSearch={handleSearch}
      handleRefresh={handleRefresh}
      refreshLoading={refreshLoading}
      tableRef={tableRef}
    />
  );
}

type BucketWithVisibleColumnsProps = {
  bucket: BucketType;
  formattedColumns: ColumnType[];
  bucketData: any;
  handleScrollEnd: () => void;
  bucketDataLoading: boolean;
  isTableLoading: boolean;
  handleSearch: (search: string) => Promise<void>;
  handleRefresh: () => Promise<void>;
  refreshLoading: boolean;
  tableRef: React.RefObject<HTMLElement | null>;
};

function BucketWithVisibleColumns({
  bucket,
  formattedColumns,
  bucketData,
  handleScrollEnd,
  bucketDataLoading,
  isTableLoading,
  handleSearch,
  handleRefresh,
  refreshLoading,
  tableRef
}: BucketWithVisibleColumnsProps) {
  const defaultVisibleColumns = useMemo(
    () => Object.fromEntries(formattedColumns.map(col => [col.key, true])),
    [formattedColumns]
  );

  const [visibleColumns, setVisibleColumns] = useLocalStorage<{[key: string]: boolean}>(
    `${bucket._id}-visible-columns`,
    defaultVisibleColumns
  );

  useEffect(() => {
    if (Object.keys(defaultVisibleColumns).length > Object.keys(visibleColumns).length) {
      setVisibleColumns(defaultVisibleColumns);
    }
  }, [defaultVisibleColumns, visibleColumns]);

  const filteredColumns = useMemo(
    () => formattedColumns.filter(i => visibleColumns?.[i.key]),
    [formattedColumns, visibleColumns]
  );

  const toggleColumn = (key?: string) => {
    if (key) {
      setVisibleColumns({
        ...visibleColumns,
        [key]: !visibleColumns[key]
      });
      return;
    }

    const hasHidden = Object.values(visibleColumns).some(v => !v);
    if (hasHidden) {
      setVisibleColumns({...defaultVisibleColumns});
    } else {
      setVisibleColumns({
        ...Object.fromEntries(Object.keys(defaultVisibleColumns).map(k => [k, false])),
        _id: true
      });
    }
  };

  return (
    <div className={styles.container}>
      <BucketActionBar
        onSearch={handleSearch}
        bucket={bucket as BucketType}
        onRefresh={handleRefresh}
        columns={filteredColumns}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        searchLoading={bucketDataLoading && !isTableLoading}
        refreshLoading={refreshLoading}
      />
      <BucketTable
        bucketId={bucket._id}
        columns={filteredColumns}
        data={bucketData?.data ?? []}
        onScrollEnd={handleScrollEnd}
        totalDataLength={bucketData?.meta?.total ?? 0}
        maxHeight="88vh"
        loading={isTableLoading}
        tableRef={tableRef}
      />
    </div>
  );
}
