import styles from "./Bucket.module.scss";
import {bucketApi, useGetBucketsQuery, useDeleteBucketEntryMutation, useUpdateBucketEntryMutation} from "../../store/api/bucketApi";
import {useParams} from "react-router-dom";
import {useCallback, useEffect, useMemo, useState} from "react";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";
import type {BucketType} from "src/store/api/bucketApi";
import Loader from "../../components/atoms/loader/Loader";
import {useBucketColumns} from "../../hooks/useBucketColumns";
import {useBucketSearch} from "../../hooks/useBucketSearch";
import {useBucketDataStrategy} from "../../hooks/useBucketDataStrategy";
import {useAppDispatch} from "../../store/hook";
import {resetBucketSelection} from "../../store";
import BucketTableNew from "../../components/organisms/bucket-table/BucketTable";
import {BucketLookupContext, type BucketLookup} from "../../contexts/BucketLookupContext";
import BucketEntryDrawer from "../../components/organisms/BucketEntryDrawer/BucketEntryDrawer";
import type {FilterField} from "../../components/prefabs/filter-panel/types";


export default function Bucket() {
  const {bucketId = ""} = useParams<{bucketId: string}>();
  const [editingEntry, setEditingEntry] = useState<Record<string, any> | null>(null);
  const [isNewEntryDrawerOpen, setIsNewEntryDrawerOpen] = useState(false);
  const {data: buckets = []} = useGetBucketsQuery();
  const [deleteBucketEntry] = useDeleteBucketEntryMutation();
  const [updateBucketEntry] = useUpdateBucketEntryMutation();
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
    const skipTypes = new Set(["location", "object", "array", "json", "storage"]);
    // _id is not part of bucket.properties; surface it manually so entries can be
    // filtered by ObjectId (backend coerces the hex string to ObjectId).
    const idField: FilterField = {key: "_id", label: "ID", type: "id"};
    const derived = Object.entries(bucket.properties)
      .filter(([, prop]: [string, any]) => !skipTypes.has(prop.type))
      .map(([key, prop]: [string, any]): FilterField => {
        const strTypes = new Set(["string", "textarea", "color", "richtext", "hash", "encrypted"]);
        const fieldType: FilterField["type"] =
          prop.type === "relation" ? "relation" :
          strTypes.has(prop.type) ? "string" :
          prop.type === "number" ? "number" :
          prop.type === "date" ? "date" :
          prop.type === "boolean" ? "boolean" :
          prop.type === "multiselect" && prop.items?.enum ? "enum" : "string";
        const base: FilterField = {key, label: prop.title || key, type: fieldType};
        if (fieldType === "enum" && prop.items?.enum) {
          base.enumOptions = (prop.items.enum as string[]).map(v => ({label: v, value: v}));
        }
        if (fieldType === "relation") {
          base.relationBucketId = prop.bucketId;
        }
        return base;
      });
    return [idField, ...derived];
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

  const {bucketData, bucketDataLoading, refreshLoading, handleRefresh, loadMore, hasMore, isFetchingMore} =
    useBucketDataStrategy(bucketId, mergedSearchQuery);

  const isTableLoading = useMemo(() => formattedColumns.length <= 1, [formattedColumns]);

  // Create bucket lookup service for dependency injection
  const bucketLookup: BucketLookup = useMemo(() => {
    const idToTitleMap = new Map<string, string>();
    const idToPropertiesMap = new Map<string, Record<string, any>>();
    const idToPrimaryKeyMap = new Map<string, string>();
    const relationLabelCache = new Map<string, string>(); // Key: "bucketId:documentId"

    for (const bucket of buckets) {
      if (bucket._id && bucket.title) {
        idToTitleMap.set(bucket._id, bucket.title);
      }
      if (bucket._id && bucket.properties) {
        idToPropertiesMap.set(bucket._id, bucket.properties);
      }
      if (bucket._id && bucket.primary) {
        idToPrimaryKeyMap.set(bucket._id, bucket.primary);
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
      },
      getBucketPrimaryKey(bucketId: string): string | undefined {
        return idToPrimaryKeyMap.get(bucketId);
      }
    };
  }, [buckets]);
  
  const deleteBucketEntries = useCallback(
    async (entryIds: string[], bucketId: string): Promise<{failed: string[]; succeeded: string[]}> => {
      if (!entryIds.length) {
        return {failed: [], succeeded: []};
      }

      // Delete each entry with a direct DELETE request. allSettled keeps a single
      // failure from aborting the rest, so partial successes are reported per id.
      const results = await Promise.allSettled(
        entryIds.map(entryId => deleteBucketEntry({bucketId, entryId}).unwrap())
      );

      const succeeded: string[] = [];
      const rejected: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          succeeded.push(entryIds[index]);
        } else {
          rejected.push(entryIds[index]);
        }
      });

      // A rejected request doesn't always mean the entry survived: the API can
      // return 500 from a post-delete step (e.g. clearing relations) after the
      // document has already been removed. Verify each rejected id by fetching
      // it — a deleted entry comes back empty, so only ids that still resolve to
      // a real document are reported as genuine failures.
      const failed: string[] = [];
      if (rejected.length) {
        const checks = await Promise.allSettled(
          rejected.map(entryId => {
            const subscription = dispatch(
              bucketApi.endpoints.getBucketEntry.initiate({bucketId, entryId}, {forceRefetch: true})
            );
            return subscription
              .unwrap()
              .then((entry: any) => Boolean(entry && entry._id))
              .finally(() => subscription.unsubscribe());
          })
        );

        checks.forEach((check, index) => {
          const entryId = rejected[index];
          const stillExists = check.status === "fulfilled" && check.value === true;
          if (stillExists) {
            console.error(`Failed to delete bucket entry ${entryId}`);
            failed.push(entryId);
          } else {
            succeeded.push(entryId);
          }
        });
      }

      return {succeeded, failed};
    },
    [deleteBucketEntry, dispatch]
  );

  const handleExpandRow = useCallback((row: Record<string, any>) => {
    setEditingEntry(row);
  }, []);

  const handleDataChange = useCallback(
    (rowId: string, propertyKey: string, newValue: any) => {
      if (!bucketId) return;
      updateBucketEntry({bucketId, entryId: rowId, data: {[propertyKey]: newValue}});
    },
    [bucketId, updateBucketEntry]
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
          totalCount={bucketData?.meta?.total ?? 0}
          onExpandRow={handleExpandRow}
          onDataChange={handleDataChange}
          onNewEntry={handleOpenNewEntry}
          onSort={setAppliedSort}
          loading={bucketDataLoading}
          visibleColumns={visibleColumns}
          onLoadMore={loadMore}
          hasMore={hasMore}
          isLoadingMore={isFetchingMore}
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
