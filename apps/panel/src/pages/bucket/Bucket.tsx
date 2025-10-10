import styles from "./Bucket.module.scss";
import { useGetBucketsQuery, useGetBucketDataQuery } from "../../store/api/bucketApi";
import {useParams} from "react-router-dom";
import BucketTable, {type ColumnType} from "../../components/organisms/bucket-table/BucketTable";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";
import type {BucketDataQueryWithIdType, BucketType} from "src/store/api/bucketApi";
import useLocalStorage from "../../hooks/useLocalStorage";
import Loader from "../../components/atoms/loader/Loader";

const escapeForRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const buildBucketQuery = (searchText: string, searchableColumns: string[]) =>
  ({
    paginate: true,
    relation: true,
    limit: 25,
    filter: {
      $or: searchableColumns.map(col => ({
        [col]: {$regex: escapeForRegex(searchText), $options: "i"}
      }))
    }
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

  const [searchQuery, setSearchQuery] = useState<BucketDataQueryWithIdType | undefined>();
  const {bucketId} = useParams<{bucketId: string}>();
  
  useEffect(() => {
    setSearchQuery(undefined);
  }, [bucketId]);
  
  const { data: buckets = [] } = useGetBucketsQuery();
  const { 
    data: bucketDataResponse,
    isLoading: bucketDataLoading,
    refetch: refreshBucketData
  } = useGetBucketDataQuery(
    searchQuery || {
      bucketId: bucketId!,
      paginate: true,
      relation: true,
      limit: 25,
      sort: { _id: -1 }
    },
    { 
      skip: !bucketId,
      refetchOnMountOrArgChange: 10,
      refetchOnFocus: true,
    }
  );
  
  const bucketData = bucketDataResponse ? {
    ...bucketDataResponse,
    bucketId: bucketId!
  } : null;

  const bucket = useMemo(() => buckets?.find((i: BucketType) => i._id === bucketId), [buckets, bucketId]);

  const [refreshLoading, setRefreshLoading] = useState(false);
  const tableRef = useRef<HTMLElement | null>(null);


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

  const defaultVisibleColumns = useMemo(
    () => Object.fromEntries(formattedColumns.map(col => [col.key, true])),
    [formattedColumns]
  );

  const visibleColumnsStorageKey = `${bucketId}-visible-columns`;
  const [visibleColumns, setVisibleColumns] = useLocalStorage<{[key: string]: boolean}>(
    visibleColumnsStorageKey,
    defaultVisibleColumns
  );

  const filteredColumns = useMemo(
    () => formattedColumns.filter(column => visibleColumns?.[column.key]),
    [formattedColumns, visibleColumns]
  );

  const isTableLoading = useMemo(() => !(formattedColumns.length > 1), [formattedColumns]);

  useEffect(() => {
    if (!bucketId || !formattedColumns.length) return;

    const currentVisibleKeys = Object.keys(visibleColumns as unknown as {[key: string]: boolean} || {});
    const defaultKeys = Object.keys(defaultVisibleColumns);
    const newColumns = defaultKeys.filter(key => !currentVisibleKeys.includes(key));
    
    if (newColumns.length > 0) {
      setVisibleColumns({
        ...visibleColumns,
        ...Object.fromEntries(newColumns.map(key => [key, true]))
      });
    }
  }, [bucketId, defaultVisibleColumns, formattedColumns]);


  const handleSearch = useCallback(
    async (search: string) => {
      const trimmed = search.trim();
      const query = trimmed === "" ? undefined : buildBucketQuery(trimmed, searchableColumns);
      setSearchQuery(query ? { bucketId: bucketId!, ...query } : undefined);
    },
    [bucketId, searchableColumns]
  );
  
  const loadMoreBucketData = useCallback(async () => {
    console.log('Load more data - implement pagination logic here');
  }, []);

  const handleRefresh = useCallback(async () => {
    if (tableRef.current) await smoothScrollToTop(tableRef.current);
    setRefreshLoading(true);
    await refreshBucketData();
    setRefreshLoading(false);
  }, [bucketId, refreshBucketData]);

  const toggleColumn = (key?: string) => {
    if (key) {
      setVisibleColumns({
        ...visibleColumns,
        [key]: !visibleColumns[key]
      });
      return;
    }

    const hasHiddenColumns = Object.values(visibleColumns).some(isVisible => !isVisible);

    if (hasHiddenColumns) {
      setVisibleColumns(defaultVisibleColumns);
    } else {
      // Hide all columns except _id
      setVisibleColumns(
        Object.fromEntries(formattedColumns.map(col => [col.key, col.key === "_id"]))
      );
    }
  };

  if (formattedColumns.length <= 1 || !bucket) {
    return <Loader />;
  }

  return (
    <div className={styles.container}>
      <BucketActionBar
        onSearch={handleSearch}
        bucket={bucket as BucketType}
        onRefresh={handleRefresh}
        columns={formattedColumns}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        searchLoading={bucketDataLoading && !isTableLoading}
        refreshLoading={refreshLoading}
      />
      <BucketTable
        bucketId={bucket._id}
        columns={filteredColumns}
        data={bucketData?.data ?? []}
        onScrollEnd={loadMoreBucketData}
        totalDataLength={bucketData?.meta?.total ?? 0}
        maxHeight="88vh"
        loading={isTableLoading}
        tableRef={tableRef}
      />
    </div>
  );
}
