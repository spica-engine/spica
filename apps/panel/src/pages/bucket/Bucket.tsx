import styles from "./Bucket.module.scss";
import {useBucket} from "../../contexts/BucketContext";
import {useParams} from "react-router-dom";
import BucketTable, {type ColumnType} from "../../components/organisms/bucket-table/BucketTable";
import {useCallback, useEffect, useMemo} from "react";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";
import type {BucketDataQueryWithIdType} from "../../services/bucketService";
import useLocalStorage from "../../hooks/useLocalStorage";
import Loader from "../../components/atoms/loader/Loader";

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
      await getBucketData(bucketId as string, query as unknown as BucketDataQueryWithIdType);
      cleanBucketData();
    },
    [bucketId, searchableColumns, getBucketData]
  );

  const isTableLoading = useMemo(
    () => !(formattedColumns.length > 1 && nextbucketDataQuery?.bucketId === bucketId),
    [formattedColumns, nextbucketDataQuery, bucketId]
  );

  if (formattedColumns.length <= 1) {
    return <Loader/>
  }

  return (
    <BucketWithVisibleColumns
      bucketId={bucketId as string}
      formattedColumns={formattedColumns as ColumnType[]}
      bucketData={bucketData}
      handleScrollEnd={handleScrollEnd}
      bucketDataLoading={bucketDataLoading}
      isTableLoading={isTableLoading}
      handleSearch={handleSearch}
    />
  );
}

type BucketWithVisibleColumnsProps = {
  bucketId: string;
  formattedColumns: ColumnType[];
  bucketData: any;
  handleScrollEnd: () => void;
  bucketDataLoading: boolean;
  isTableLoading: boolean;
  handleSearch: (search: string) => Promise<void>;
};

function BucketWithVisibleColumns({
  bucketId,
  formattedColumns,
  bucketData,
  handleScrollEnd,
  bucketDataLoading,
  isTableLoading,
  handleSearch
}: BucketWithVisibleColumnsProps) {
  const defaultVisibleColumns = useMemo(
    () => Object.fromEntries(formattedColumns.map(col => [col.key, true])),
    []
  );

  const [visibleColumns, setVisibleColumns] = useLocalStorage<{[key: string]: boolean}>(
    `${bucketId}-visible-columns`,
    defaultVisibleColumns
  );

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
        columns={formattedColumns}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        bucketId={bucketId as string}
        onSearch={handleSearch}
        searchLoading={bucketDataLoading && !isTableLoading}
      />
      <BucketTable
        bucketId={bucketId as string}
        columns={filteredColumns}
        data={bucketData?.data ?? []}
        onScrollEnd={handleScrollEnd}
        totalDataLength={bucketData?.meta?.total ?? 0}
        maxHeight="88vh"
        loading={isTableLoading}
      />
    </div>
  );
}
