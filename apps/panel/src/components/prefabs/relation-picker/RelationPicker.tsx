/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {useCallback, useState, useEffect, useMemo} from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import FilterPanel from "../filter-panel/FilterPanel";
import type {FilterField} from "../filter-panel/types";
import type {Property} from "src/store/api/bucketApi";
import {Button, FlexElement, FluidContainer, Text} from "oziko-ui-kit";
import styles from "./RelationPicker.module.scss";
import {useGetBucketDataQuery, useGetBucketQuery, useLazyGetBucketDataQuery} from "../../../store/api/bucketApi";
import { extractPrimaryFieldValue } from "./primaryFieldUtils";
import { useBucketLookup } from "../../../contexts/BucketLookupContext";

type RelationPickerProps = {
  bucketId?: string | null;
  onSelect?: (value: any) => void;
  onCancel?: () => void;
  currentValue?: any;
  bucketProperties?: Record<string, Property>;
};

const RelationPicker: React.FC<RelationPickerProps> = ({
  bucketId,
  onSelect,
  onCancel,
  currentValue,
  bucketProperties: providedBucketProperties
}) => {
  const [appliedFilter, setAppliedFilter] = useState<Record<string, any> | null>(null);
  const [additionalPages, setAdditionalPages] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const LIMIT = 7;
  const hasBucketId = typeof bucketId === "string" && bucketId.trim().length > 0;
  const resolvedBucketId = hasBucketId ? bucketId : undefined;
  
  const {data: bucket} = useGetBucketQuery(resolvedBucketId as string, {
    skip: !resolvedBucketId,
  });
  const bucketLookup = useBucketLookup();
  
  const { data: initialData, isLoading: isInitialLoading, isFetching } = useGetBucketDataQuery({
    bucketId: resolvedBucketId as string,
    paginate: true,
    relation: true,
    limit: LIMIT,
    skip: 0,
    sort: { _id: -1 },
    filter: appliedFilter || undefined
  }, {
    skip: !resolvedBucketId,
  });

  const [getBucketData] = useLazyGetBucketDataQuery();

  const items = useMemo(() => {
    const initial = initialData?.data || [];
    return [...initial, ...additionalPages];
  }, [initialData, additionalPages]);

  const [lastPageSize, setLastPageSize] = useState<number>(LIMIT);

  const hasMore = useMemo(() => {
    if (!initialData) return false;
    
    if (lastPageSize < LIMIT) return false;
    
    if (initialData.meta?.total !== undefined) {
      return items.length < initialData.meta.total;
    }
    
    return lastPageSize === LIMIT;
  }, [initialData, items.length, lastPageSize, LIMIT]);

  useEffect(() => {
    setAdditionalPages([]);
    setCurrentPage(0);
    setLastPageSize(LIMIT);
  }, [appliedFilter, bucketId, LIMIT]);

  useEffect(() => {
    if (initialData?.data) {
      setLastPageSize(initialData.data.length);
    }
  }, [initialData]);

  const fetchMoreData = useCallback(async () => {
    if (!resolvedBucketId || isFetching) return;
    
    const nextPage = currentPage + 1;
    const skipValue = nextPage * LIMIT;

    try {
      const result = await getBucketData({
        bucketId: resolvedBucketId,
        paginate: true,
        relation: true,
        limit: LIMIT,
        skip: skipValue,
        sort: { _id: -1 },
        filter: appliedFilter || undefined
      }).unwrap();

      if (result?.data) {
        const fetchedCount = result.data.length;
        
        setLastPageSize(fetchedCount);
        
        if (fetchedCount > 0) {
          setAdditionalPages(prev => [...prev, ...result.data]);
          setCurrentPage(nextPage);
        }
      }
    } catch (error) {
      console.error('Error fetching more data:', error);
    }
  }, [resolvedBucketId, appliedFilter, currentPage, LIMIT, getBucketData, isFetching]);

  const filterFields = useMemo((): FilterField[] => {
    const props = bucket?.properties || {};
    const skipTypes = new Set(["relation", "location", "object", "array", "json", "storage"]);
    return Object.entries(props)
      .filter(([, prop]: [string, any]) => !skipTypes.has(prop.type))
      .map(([key, prop]: [string, any]): FilterField => {
        const strTypes = new Set(["string", "textarea", "color", "richtext", "hash", "encrypted"]);
        const type: FilterField["type"] =
          strTypes.has(prop.type) ? "string" :
          prop.type === "number" ? "number" :
          prop.type === "date" ? "date" :
          prop.type === "boolean" ? "boolean" :
          prop.type === "multiselect" && prop.items?.enum ? "enum" : "string";
        const field: FilterField = {key, label: prop.title || key, type};
        if (type === "enum" && prop.items?.enum) {
          field.enumOptions = (prop.items.enum as string[]).map((v: string) => ({label: v, value: v}));
        }
        return field;
      });
  }, [bucket]);

  const handleFilterApply = useCallback((filter: Record<string, any> | null) => {
    setAppliedFilter(filter);
    setAdditionalPages([]);
    setCurrentPage(0);
  }, []);

  const handleFilterClear = useCallback(() => {
    setAppliedFilter(null);
    setAdditionalPages([]);
    setCurrentPage(0);
  }, []);

  return (
    <FlexElement direction="vertical" gap={10}>
      {!resolvedBucketId && (
        <FlexElement dimensionX="fill" dimensionY={100} alignment="center" className={styles.empty}>
          <Text size="medium">Relation bucket is not configured.</Text>
        </FlexElement>
      )}

      {resolvedBucketId && filterFields.length > 0 && (
        <FilterPanel
          fields={filterFields}
          onApply={handleFilterApply}
          onClear={handleFilterClear}
          className={styles.filter}
        />
      )}
      
      {resolvedBucketId && items.length === 0 && !isInitialLoading && !isFetching && (
        <FlexElement dimensionX="fill" dimensionY={100} alignment="center" className={styles.empty}>
          <Text size="medium">No data found</Text>
        </FlexElement>
      )}

      {resolvedBucketId && isInitialLoading && items.length === 0 && (
        <FlexElement dimensionX="fill" dimensionY={100} alignment="center">
          <Text size="medium">Loading...</Text>
        </FlexElement>
      )}
      
      {resolvedBucketId && items.length > 0 && (
        <div id="scrollableDiv" className={styles.scrollableContainer}>
          <InfiniteScroll
            dataLength={items.length}
            next={fetchMoreData}
            hasMore={hasMore}
            loader={
              <FlexElement dimensionX="fill" alignment="center" className={styles.loader}>
                <Text size="small">Loading...</Text>
              </FlexElement>
            }
            scrollableTarget="scrollableDiv"
          >
            <FlexElement
              dimensionX="fill"
              direction="vertical"
              alignment="leftCenter"
              gap={0}
            >
              {items.map((item: any) => {
                const properties = bucket?.properties || {};
                const primaryFieldValue = extractPrimaryFieldValue(item, properties);
                
                const handleItemSelect = () => {
                      bucketLookup.setRelationLabel(resolvedBucketId, item._id, primaryFieldValue);
                  
                  onSelect?.({
                    id: item._id,
                    label: primaryFieldValue
                  });
                };
                
                return (
                  <FluidContainer
                    key={item._id}
                    className={styles.item}
                    mode="fill"
                    dimensionX="fill"
                    gap={10}
                    prefix={{
                      children: <Text size="medium">{item._id}</Text>
                    }}
                    root={{
                      children: (
                        <Text size="medium" dimensionX="fill">
                          {primaryFieldValue}
                        </Text>
                      )
                    }}
                    onClick={handleItemSelect}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleItemSelect();
                      }
                    }}
                  />
                );
              })}
            </FlexElement>
          </InfiniteScroll>
        </div>
      )}

      <FlexElement dimensionX="fill" direction="horizontal" gap={10} alignment="rightCenter">
        <Button variant="filled" onClick={onCancel}>
          Cancel
        </Button>
      </FlexElement>
    </FlexElement>
  );
};

export default RelationPicker;
