import styles from "./Bucket.module.scss";
import {useExecuteBatchMutation, type BatchResponse, type BatchResponseItem} from "../../store/api/batchApi";
import {useUpdateBucketEntryMutation, useGetBucketsQuery} from "../../store/api/bucketApi";
import {useParams} from "react-router-dom";
import {useCallback, useEffect, useMemo} from "react";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";
import type {BucketType} from "src/services/bucketService";
import Loader from "../../components/atoms/loader/Loader";
import {useBucketColumns} from "../../hooks/useBucketColumns";
import {useBucketSearch} from "../../hooks/useBucketSearch";
import {useBucketData} from "../../hooks/useBucketData";
import {useAppDispatch, useAppSelector} from "../../store/hook";
import {resetBucketSelection} from "../../store";
import {selectParsedToken} from "../../store/slices/authSlice";
import BucketTableNew from "../../components/organisms/bucket-table/BucketTable";
import {BucketLookupContext, type BucketLookup} from "../../contexts/BucketLookupContext";


export default function Bucket() {
  const {bucketId = ""} = useParams<{bucketId: string}>();
  const {data: buckets = []} = useGetBucketsQuery();
  const [executeBatchRequest] = useExecuteBatchMutation();
  const [updateBucketEntry] = useUpdateBucketEntryMutation();
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

  const {formattedColumns, visibleColumns, searchableColumns, toggleColumn} =
    useBucketColumns(bucket, bucketId);

  const {searchQuery, handleSearch} = useBucketSearch(bucketId, searchableColumns);

  const {bucketData, bucketDataLoading, refreshLoading, handleRefresh} =
    useBucketData(bucketId, searchQuery);

  const isTableLoading = useMemo(() => formattedColumns.length <= 1, [formattedColumns]);
  const authToken = useAppSelector(selectParsedToken);
  
  // Create bucket lookup service for dependency injection
  const bucketLookup: BucketLookup = useMemo(() => {
    const idToTitleMap = new Map<string, string>();
    const idToPropertiesMap = new Map<string, Record<string, any>>();
    const relationLabelCache = new Map<string, string>(); // Key: "bucketId:documentId"
    
    for (const bucket of buckets) {
      if (bucket._id && bucket.title) {
        idToTitleMap.set(bucket._id, bucket.title);
      }
      if (bucket._id && bucket.properties) {
        idToPropertiesMap.set(bucket._id, bucket.properties);
      }
    }
    
    return {
      getTitleById(id: string): string | undefined {
        return idToTitleMap.get(id);
      },
      getRelationLabel(bucketId: string, documentId: string): string | null {
        const key = `${bucketId}:${documentId}`;
        return relationLabelCache.get(key) ?? null;
      },
      setRelationLabel(bucketId: string, documentId: string, label: string): void {
        const key = `${bucketId}:${documentId}`;
        relationLabelCache.set(key, label);
      },
      getBucketProperties(bucketId: string): Record<string, any> | undefined {
        return idToPropertiesMap.get(bucketId);
      }
    };
  }, [buckets]);
  
  const handleDataChange = useCallback(
    async (rowId: string, propertyKey: string, newValue: any) => {
      try {
        await updateBucketEntry({
          bucketId,
          entryId: rowId,
          data: {
            [propertyKey]: newValue
          }
        }).unwrap();
        
        // Optionally refresh data
        handleRefresh();
      } catch (error) {
        console.error("Failed to save data:", error);
      }
    },
    [bucketId]
  );

  const deleteBucketEntries = useCallback(
    async (entryIds: string[], bucketId: string): Promise<{failed: string[]; succeeded: string[]}> => {
      if (!entryIds.length) {
        return {failed: [], succeeded: []};
      }

      try {
        const hasToken = typeof authToken === "string" && authToken.trim().length > 0;
        const authorizationHeader = hasToken ? {Authorization: `IDENTITY ${authToken}`} : undefined;

        const batchResult: BatchResponse = await executeBatchRequest({
          requests: entryIds.map(entryId => ({
            id: entryId,
            method: "DELETE" as const,
            url: `/bucket/${bucketId}/data/${entryId}`,
            headers: authorizationHeader
          }))
        }).unwrap();

        const responses: BatchResponseItem[] = batchResult.responses ?? [];

        const getResponseStatus = (responseItem: BatchResponseItem): number | undefined => {
          const candidates = [
            responseItem.error?.status,
            responseItem.response?.status,
            responseItem.response?.statusCode
          ];

          return candidates.find((status): status is number => typeof status === "number");
        };

        const isFailedResponse = (responseItem: BatchResponseItem): boolean => {
          if (responseItem.error) {
            return true;
          }

          const status = getResponseStatus(responseItem);
          return typeof status === "number" && (status < 200 || status >= 300);
        };

        const failedIds = responses.filter(isFailedResponse).map(responseItem => responseItem.id);

        const succeededIds = entryIds.filter(id => !failedIds.includes(id));

        return {failed: failedIds, succeeded: succeededIds};
      } catch (error) {
        console.error("Failed to delete bucket entries:", error);
        return {failed: entryIds, succeeded: []};
      }
    },
    [executeBatchRequest, authToken]
  );

  if (formattedColumns.length <= 1 || !bucket) {
    return <Loader />;
  }

  return (
    <BucketLookupContext.Provider value={bucketLookup}>
      <div className={styles.container}>
        <BucketActionBar
          onSearch={handleSearch}
          bucket={bucket as BucketType}
          bucketData={bucketData?.data ?? []}
          deleteBucketEntries={deleteBucketEntries}
          onRefresh={handleRefresh}
          columns={formattedColumns}
          visibleColumns={visibleColumns}
          toggleColumn={toggleColumn}
          searchLoading={bucketDataLoading && !isTableLoading}
          refreshLoading={refreshLoading}
        />
        <BucketTableNew
          bucket={bucket as any}
          data={bucketData?.data ?? []}
          onDataChange={handleDataChange}
        />
      </div>
    </BucketLookupContext.Provider>
  );
}
