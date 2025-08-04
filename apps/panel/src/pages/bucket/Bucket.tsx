import styles from "./Bucket.module.scss";
import {useBucket} from "../../contexts/BucketContext";
import {useParams} from "react-router-dom";
import BucketTable, {type ColumnType} from "../../components/organisms/bucket-table/BucketTable";
import {useCallback, useEffect, useMemo} from "react";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";
import type {BucketDataQueryType} from "src/services/bucketService";
import useLocalStorage from "../../hooks/useLocalStorage";
import Loader from "../../components/atoms/loader/Loader";

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
    ];
  }, [buckets, bucketId]);

  const handleScrollEnd = useCallback(() => {
    if (!bucketId) return;
    const query = nextbucketDataQuery;
    if (query?.bucketId) {
      delete (query as any).bucketId;
    }
    getBucketData(bucketId, query as BucketDataQueryType);
  }, [bucketId, getBucketData, nextbucketDataQuery]);

  if (formattedColumns.length <= 1 || nextbucketDataQuery?.bucketId !== bucketId || !bucketId) {
    return <Loader />;
  }

  return (
    <BucketWithVisibleColumns
      bucketId={bucketId}
      formattedColumns={formattedColumns as ColumnType[]}
      bucketData={bucketData}
      handleScrollEnd={handleScrollEnd}
      nextbucketDataQuery={nextbucketDataQuery}
    />
  );
}

type BucketWithVisibleColumnsProps = {
  bucketId: string;
  formattedColumns: ColumnType[];
  bucketData: any;
  handleScrollEnd: () => void;
  nextbucketDataQuery: any;
};

function BucketWithVisibleColumns({
  bucketId,
  formattedColumns,
  bucketData,
  handleScrollEnd,
  nextbucketDataQuery
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

  const toggleColumn = (key: string) => {
    setVisibleColumns({...visibleColumns, [key]: !visibleColumns[key]});
  };

  return (
    <div className={styles.container}>
      <BucketActionBar
        columns={formattedColumns}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
      />
      <BucketTable
        bucketId={bucketId}
        columns={filteredColumns}
        data={bucketData?.data ?? []}
        onScrollEnd={handleScrollEnd}
        totalDataLength={bucketData?.meta?.total ?? 0}
        maxHeight="88vh"
        loading={!(formattedColumns.length > 1 && nextbucketDataQuery?.bucketId === bucketId)}
      />
    </div>
  );
}

