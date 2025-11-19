import styles from "./Bucket.module.scss";
import {useGetBucketsQuery, useDeleteBucketEntryMutation} from "../../store/api/bucketApi";
import {useParams} from "react-router-dom";
import BucketTable from "../../components/organisms/bucket-table/BucketTable";
import {useCallback, useEffect, useMemo} from "react";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";
import type {BucketType} from "src/services/bucketService";
import Loader from "../../components/atoms/loader/Loader";
import {useBucketColumns} from "../../hooks/useBucketColumns";
import {useBucketSearch} from "../../hooks/useBucketSearch";
import {useBucketData} from "../../hooks/useBucketData";
import {useAppDispatch} from "../../store/hook";
import {resetBucketSelection} from "../../store";

export default function Bucket() {
  const {bucketId = ""} = useParams<{bucketId: string}>();
  const {data: buckets = []} = useGetBucketsQuery();
  const [deleteBucketEntryMutation] = useDeleteBucketEntryMutation();
  const dispatch = useAppDispatch();

  const bucket = useMemo(
    () => buckets?.find((i: BucketType) => i._id === bucketId),
    [buckets, bucketId]
  );

  useEffect(() => {
    if (bucketId) {
      dispatch(resetBucketSelection(bucketId));
    }
  }, [bucketId, dispatch]);

  const {formattedColumns, filteredColumns, visibleColumns, searchableColumns, toggleColumn} =
    useBucketColumns(bucket, bucketId);

  const {searchQuery, handleSearch} = useBucketSearch(bucketId, searchableColumns);

  const {bucketData, bucketDataLoading, refreshLoading, tableRef, handleRefresh, loadMoreBucketData} =
    useBucketData(bucketId, searchQuery);

  const isTableLoading = useMemo(() => formattedColumns.length <= 1, [formattedColumns]);

  const deleteBucketEntry = useCallback(
    async (entryId: string, bucketId: string): Promise<string | null> => {
      try {
        await deleteBucketEntryMutation({entryId, bucketId}).unwrap();
        return entryId;
      } catch (error) {
        console.error("Failed to delete bucket entry:", error);
        return null;
      }
    },
    [deleteBucketEntryMutation]
  );

  if (formattedColumns.length <= 1 || !bucket) {
    return <Loader />;
  }

  return (
    <div className={styles.container}>
      <BucketActionBar
        onSearch={handleSearch}
        bucket={bucket as BucketType}
        bucketData={bucketData?.data ?? []}
        deleteBucketEntry={deleteBucketEntry}
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
        primaryKey={bucket.primary || "_id"}
      />
    </div>
  );
}
