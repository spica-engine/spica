import styles from "./Bucket.module.scss";
import {useExecuteBatchMutation, type BatchResponse, type BatchResponseItem} from "../../store/api/batchApi";
import {useGetBucketsQuery} from "../../store/api/bucketApi";
import {useParams} from "react-router-dom";
import {useCallback, useEffect, useMemo, useState} from "react";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";
import type {BucketType} from "src/store/api/bucketApi";
import Loader from "../../components/atoms/loader/Loader";
import {useBucketColumns} from "../../hooks/useBucketColumns";
import {useBucketSearch} from "../../hooks/useBucketSearch";
import {useBucketData} from "../../hooks/useBucketData";
import {useAppDispatch, useAppSelector} from "../../store/hook";
import {resetBucketSelection} from "../../store";
import {selectParsedToken} from "../../store/slices/authSlice";
import BucketTableNew from "../../components/organisms/bucket-table/BucketTable";
import {BucketLookupContext, type BucketLookup} from "../../contexts/BucketLookupContext";
import BucketEntryDrawer from "../../components/organisms/BucketEntryDrawer/BucketEntryDrawer";
import type {FilterField} from "../../components/prefabs/filter-panel/types";


export default function Bucket() {
  const {bucketId = ""} = useParams<{bucketId: string}>();
  const [editingEntry, setEditingEntry] = useState<Record<string, any> | null>(null);
  const [isNewEntryDrawerOpen, setIsNewEntryDrawerOpen] = useState(false);
  const {data: buckets = []} = useGetBucketsQuery();
  const [executeBatchRequest] = useExecuteBatchMutation();
  const dispatch = useAppDispatch();
  const [appliedFilter, setAppliedFilter] = useState<Record<string, any> | null>(null);
  const [appliedSort, setAppliedSort] = useState<Record<string, 1 | -1> | null>(null);

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

  // Derive FilterField[] from bucket.properties for the filter panel
  const filterFields = useMemo((): FilterField[] => {
    if (!bucket?.properties) return [];
    const skipTypes = new Set(["relation", "location", "object", "array", "json", "storage"]);
    return Object.entries(bucket.properties)
      .filter(([, prop]: [string, any]) => !skipTypes.has(prop.type))
      .map(([key, prop]: [string, any]): FilterField => {
        const strTypes = new Set(["string", "textarea", "color", "richtext", "hash", "encrypted"]);
        const fieldType: FilterField["type"] =
          strTypes.has(prop.type) ? "string" :
          prop.type === "number" ? "number" :
          prop.type === "date" ? "date" :
          prop.type === "boolean" ? "boolean" :
          prop.type === "multiselect" && prop.items?.enum ? "enum" : "string";
        const base: FilterField = {key, label: prop.title || key, type: fieldType};
        if (fieldType === "enum" && prop.items?.enum) {
          base.enumOptions = (prop.items.enum as string[]).map(v => ({label: v, value: v}));
        }
        return base;
      });
  }, [bucket]);

  // Merge filter/sort into searchQuery for useBucketData
  const mergedSearchQuery = useMemo(() => {
    if (!appliedFilter && !appliedSort) return searchQuery;
    const merged = {...(searchQuery ?? {})};
    if (appliedSort) {
      merged.sort = appliedSort as any;
    }
    if (appliedFilter) {
      const existing = (searchQuery as any)?.filter;
      merged.filter = existing
        ? {$and: [existing, appliedFilter]}
        : appliedFilter;
    }
    return merged;
  }, [searchQuery, appliedFilter, appliedSort]);

  const {bucketData, bucketDataLoading, refreshLoading, handleRefresh} =
    useBucketData(bucketId, mergedSearchQuery);

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

  const handleRowClick = useCallback(
    ({row}: {row: any}) => {
      setEditingEntry(row);
    },
    []
  );

  const handleEditDrawerClose = useCallback(() => setEditingEntry(null), []);
  const handleNewEntryDrawerClose = useCallback(() => setIsNewEntryDrawerOpen(false), []);
  const handleOpenNewEntry = useCallback(() => setIsNewEntryDrawerOpen(true), []);

  if (formattedColumns.length <= 1 || !bucket) {
    return <Loader />;
  }

  return (
    <BucketLookupContext.Provider value={bucketLookup}>
      <div className={styles.container}>
        <BucketActionBar
          onSearch={handleSearch}
          onFilter={setAppliedFilter}
          onSort={setAppliedSort}
          filterFields={filterFields}
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
          onRowClick={handleRowClick}
          onNewEntry={handleOpenNewEntry}
          onSort={setAppliedSort}
          loading={bucketDataLoading}
          visibleColumns={visibleColumns}
        />

      </div>
      <BucketEntryDrawer
        bucket={bucket as BucketType}
        entry={editingEntry}
        isOpen={editingEntry !== null}
        onClose={handleEditDrawerClose}
        onEntryCreated={handleRefresh}
      />
      <BucketEntryDrawer
        bucket={bucket as BucketType}
        isOpen={isNewEntryDrawerOpen}
        onClose={handleNewEntryDrawerClose}
        onEntryCreated={handleRefresh}
      />
    </BucketLookupContext.Provider>
  );
}
