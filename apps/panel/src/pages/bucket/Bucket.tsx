import styles from "./Bucket.module.scss";
import {bucketApi, useGetBucketsQuery, useGetBucketEntryQuery, useDeleteBucketEntryMutation, useUpdateBucketEntryMutation} from "../../store/api/bucketApi";
import {useLocation, useNavigate, useParams, useSearchParams} from "react-router-dom";
import {useCallback, useEffect, useMemo, useState} from "react";
import type {RelationStackEntry} from "../../components/organisms/BucketEntryDrawer/relationNavigation";
import BucketActionBar from "../../components/molecules/bucket-action-bar/BucketActionBar";
import type {BucketType} from "src/store/api/bucketApi";
import Loader from "../../components/atoms/loader/Loader";
import {useBucketColumns} from "../../hooks/useBucketColumns";
import {useBucketSearch} from "../../hooks/useBucketSearch";
import {useEngine} from "../../hooks/useEngine";
import type {DataEngine} from "../../store/api/statusApi";
import {useBucketDataStrategy} from "../../hooks/useBucketDataStrategy";
import {useAppDispatch} from "../../store/hook";
import {resetBucketSelection} from "../../store";
import BucketTableNew from "../../components/organisms/bucket-table/BucketTable";
import {BucketLookupContext, type BucketLookup} from "../../contexts/BucketLookupContext";
import BucketEntryDrawer from "../../components/organisms/BucketEntryDrawer/BucketEntryDrawer";
import type {FilterField, FilterConditionRow} from "../../components/prefabs/filter-panel/types";
import {
  combineFilters,
  conditionsToExpression,
  conditionsToMongoFilter,
  decodeFilterConditions,
  encodeFilterConditions,
  isConditionActive
} from "../../components/prefabs/filter-panel/filterPanelUtils";
import { bucketKeyField, idOf, keyOf } from "../../utils/recordKey";
import { useKeyField } from "../../hooks/useKeyField";


function keyFilterField(bucket: BucketType, engine?: DataEngine): FilterField {
  const keyField = bucketKeyField(engine, bucket);
  if (engine !== "postgresql" || !keyField) return {key: "_id", label: "ID", type: "id"};
  const type = (bucket.properties as any)?.[keyField]?.type;
  return {
    key: keyField,
    label: "ID",
    type: type === "integer" || type === "bigint" ? "number" : type === "string" ? "string" : "id"
  };
}

export default function Bucket() {
  const {bucketId = "", entryId = ""} = useParams<{bucketId: string; entryId: string}>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get("filter");
  const [isNewEntryDrawerOpen, setIsNewEntryDrawerOpen] = useState(false);
  const {data: buckets = []} = useGetBucketsQuery();
  const [deleteBucketEntry] = useDeleteBucketEntryMutation();
  const [updateBucketEntry] = useUpdateBucketEntryMutation();
  const dispatch = useAppDispatch();
  const [appliedSort, setAppliedSort] = useState<Record<string, 1 | -1> | null>(null);

  // Filter state is owned by the URL (`?filter=`), so it is shareable and the
  // relation-click that lands on `/bucket/:id?filter=...` seeds the same panel.
  const appliedConditions = useMemo(() => decodeFilterConditions(filterParam), [filterParam]);
  const setFilterConditions = useCallback(
    (conditions: FilterConditionRow[]) => {
      const next = new URLSearchParams(searchParams);
      const active = conditions.filter(isConditionActive);
      if (active.length) {
        next.set("filter", encodeFilterConditions(active));
      } else {
        next.delete("filter");
      }
      setSearchParams(next, {replace: true});
    },
    [searchParams, setSearchParams]
  );

  const bucket = useMemo(
    () => buckets?.find((i: BucketType) => idOf(i) === bucketId),
    [buckets, bucketId]
  );

  useEffect(() => {
    if (bucketId) {
      dispatch(resetBucketSelection(bucketId));
    }
  }, [bucketId, dispatch]);

  const keyField = useKeyField(bucketId) ?? "_id";
  const {formattedColumns, visibleColumns, searchableColumns, toggleColumn} =
    useBucketColumns(bucket, bucketId, keyField);

  const engine = useEngine();
  const {searchQuery, handleSearch} = useBucketSearch(bucketId, searchableColumns, engine);

  // Derive FilterField[] from bucket.properties for the filter panel
  const filterFields = useMemo((): FilterField[] => {
    if (!bucket?.properties) return [];
    const skipTypes = new Set(["location", "object", "array", "json", "storage"]);
    // _id is not part of bucket.properties; surface it manually so entries can be
    // filtered by ObjectId (backend coerces the hex string to ObjectId).
    const idField = keyFilterField(bucket, engine);
    const derived = Object.entries(bucket.properties)
      .filter(([key, prop]: [string, any]) => !skipTypes.has(prop.type) && key !== idField.key)
      .map(([key, prop]: [string, any]): FilterField => {
        const strTypes = new Set(["string", "textarea", "color", "richtext", "hash", "encrypted"]);
        const fieldType: FilterField["type"] =
          prop.type === "relation" ? "relation" :
          strTypes.has(prop.type) ? "string" :
          prop.type === "number" || prop.type === "integer" || prop.type === "bigint" ? "number" :
          prop.type === "uuid" ? "id" :
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
  }, [bucket, engine]);

  // The MongoDB filter is derived from the URL-owned conditions against this
  // bucket's fields (a relation click lands as an `_id equals` condition here).
  const appliedFilter = useMemo(() => {
    if (!appliedConditions.length) return null;
    return engine === "postgresql"
      ? conditionsToExpression(appliedConditions, filterFields)
      : conditionsToMongoFilter(appliedConditions, filterFields);
  }, [appliedConditions, filterFields, engine]);

  // Merge filter/sort into searchQuery for useBucketData
  const mergedSearchQuery = useMemo(() => {
    if (!appliedFilter && !appliedSort) return searchQuery;
    const merged = {...(searchQuery ?? {})};
    if (appliedSort) {
      merged.sort = appliedSort as any;
    }
    const combinedFilter = combineFilters([(searchQuery as any)?.filter, appliedFilter]);
    if (combinedFilter) {
      merged.filter = combinedFilter;
    }
    return merged;
  }, [searchQuery, appliedFilter, appliedSort]);

  const {bucketData, bucketDataLoading, refreshLoading, handleRefresh, loadMore, hasMore, isFetchingMore} =
    useBucketDataStrategy(bucketId, mergedSearchQuery, engine !== undefined);

  // The open document is driven entirely by the `:entryId` route segment so the URL
  // is shareable. Prefer the already-loaded row (its relations are resolved); fall
  // back to fetching by id for deep links and for docs outside the current page.
  const loadedEntry = useMemo(
    () => (entryId ? (bucketData?.data ?? []).find((row: any) => keyOf(row, keyField) === entryId) ?? null : null),
    [entryId, bucketData, keyField]
  );
  const {data: fetchedEntry} = useGetBucketEntryQuery(
    {bucketId, entryId},
    {skip: !entryId || !!loadedEntry}
  );
  const editingEntry = entryId ? loadedEntry ?? fetchedEntry ?? null : null;

  // Trail of previously-viewed documents, carried in history state, powering the
  // drawer's Back button when the user followed a relation to get here.
  const relationStack = (location.state as {relationStack?: RelationStackEntry[]})?.relationStack ?? [];
  const handleBack = useCallback(() => {
    const previous = relationStack[relationStack.length - 1];
    if (!previous) return;
    navigate(`/bucket/${previous.bucketId}/${previous.entryId}`, {
      state: {relationStack: relationStack.slice(0, -1)}
    });
  }, [relationStack, navigate]);

  const isTableLoading = useMemo(() => formattedColumns.length <= 1, [formattedColumns]);

  // Create bucket lookup service for dependency injection
  const bucketLookup: BucketLookup = useMemo(() => {
    const idToTitleMap = new Map<string, string>();
    const idToPropertiesMap = new Map<string, Record<string, any>>();
    const idToPrimaryKeyMap = new Map<string, string>();
    const relationLabelCache = new Map<string, string>(); // Key: "bucketId:documentId"

    for (const bucket of buckets) {
      if (idOf(bucket) && bucket.title) {
        idToTitleMap.set(idOf(bucket)!, bucket.title);
      }
      if (idOf(bucket) && bucket.properties) {
        idToPropertiesMap.set(idOf(bucket)!, bucket.properties);
      }
      if (idOf(bucket) && bucket.primary) {
        idToPrimaryKeyMap.set(idOf(bucket)!, bucket.primary);
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
              .then((entry: any) => Boolean(entry && keyOf(entry, keyField)))
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
    [deleteBucketEntry, dispatch, keyField]
  );

  // Preserve the active `?filter=` (and any other search params) when opening the
  // drawer — the filter is the URL-owned source of truth, so dropping it here would
  // wipe it from the list, and handleEditDrawerClose would then re-append nothing.
  const handleExpandRow = useCallback((row: Record<string, any>) => {
    const rowKey = keyOf(row, keyField);
    if (!bucketId || !rowKey) return;
    navigate(`/bucket/${bucketId}/${rowKey}${location.search}`);
  }, [bucketId, navigate, location.search, keyField]);

  const handleDataChange = useCallback(
    (rowId: string, propertyKey: string, newValue: any) => {
      if (!bucketId) return;
      updateBucketEntry({bucketId, entryId: rowId, data: {[propertyKey]: newValue}});
    },
    [bucketId, updateBucketEntry]
  );

  // Closing returns to the list route, keeping the active filter query string but
  // dropping the navigation trail so a fresh open doesn't inherit a stale Back stack.
  const handleEditDrawerClose = useCallback(() => {
    const search = searchParams.toString();
    navigate(`/bucket/${bucketId}${search ? `?${search}` : ""}`, {state: null});
  }, [navigate, bucketId, searchParams]);
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
          appliedConditions={appliedConditions}
          onFilterChange={setFilterConditions}
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
        onBack={relationStack.length > 0 ? handleBack : undefined}
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
