/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {
  Icon,
  Text,
  helperUtils,
  FlexElement,
  Button
} from "oziko-ui-kit";
import styles from "../Navigation.module.scss";
import bucketNavigationStyles from "./Bucket.module.scss";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
  type SetStateAction
} from "react";

import {useNavigate, useLocation} from "react-router-dom";
import {useGetBucketsQuery} from "../../../../store/api";
import {useUpdateBucketOrderMutation, type BucketType} from "../../../../store/api/bucketApi";
import {useDrag, useDrop} from "react-dnd";
import type {Identifier} from "dnd-core";
import AddBucketPopup from "../../../molecules/add-bucket-popup/AddBucketPopup";
import BucketNavigatorPopup from "../../../molecules/bucket-navigator-popup/BucketNavigatorPopup";
import SortableNavigationItem, {shouldPreventHover} from "../SortableNavigationItem";

const BUCKET_ITEM_TYPE = "BUCKET_NAVIGATION_ITEM";
const CATEGORY_ITEM_TYPE = "BUCKET_NAVIGATION_CATEGORY";
const CATEGORY_ORDER_STORAGE_KEY = "bucketNavigationCategoryOrder";
const UNGROUPED_CATEGORY_KEY = "__ungrouped__";

type BucketNavigationItemData = {
  _id: string;
  title: string;
  order?: number;
  category?: string;
  [key: string]: unknown;
};

type CategoryDragItem = {
  id: string;
  index: number;
  type: typeof CATEGORY_ITEM_TYPE;
};

type BucketWithIndex = {
  bucket: BucketNavigationItemData;
  index: number;
};

type CategoryGroup = {
  category: string;
  items: BucketWithIndex[];
};

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

const safeReadCategoryOrder = (): string[] => {
  if (typeof globalThis === "undefined") {
    return [];
  }

  try {
    const storedValue = globalThis?.localStorage?.getItem(CATEGORY_ORDER_STORAGE_KEY);
    if (!storedValue) {
      return [];
    }

    const parsed = JSON.parse(storedValue);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const persistCategoryOrder = (order: string[]) => {
  if (typeof globalThis === "undefined") {
    return;
  }

  if (!order.length) {
    globalThis?.localStorage?.removeItem(CATEGORY_ORDER_STORAGE_KEY);
    return;
  }

  globalThis?.localStorage?.setItem(CATEGORY_ORDER_STORAGE_KEY, JSON.stringify(order));
};

const groupBucketsByCategory = (items: BucketNavigationItemData[]) => {
  const groupedMap = new Map<string, BucketWithIndex[]>();
  const ungrouped: BucketWithIndex[] = [];

  for (const [index, bucket] of items.entries()) {
    if (bucket.category) {
      if (!groupedMap.has(bucket.category)) {
        groupedMap.set(bucket.category, []);
      }
      groupedMap.get(bucket.category)!.push({bucket, index});
    } else {
      ungrouped.push({bucket, index});
    }
  }

  const grouped: CategoryGroup[] = Array.from(groupedMap.entries()).map(([category, categoryItems]) => ({
    category,
    items: categoryItems
  }));

  return {
    grouped,
    ungrouped
  };
};


type SortableCategoryItemProps = {
  categoryKey: string;
  categoryName: string;
  index: number;
  isCollapsed: boolean;
  onToggleCollapse: (key: string) => void;
  moveCategory: (fromIndex: number, toIndex: number) => void;
  children: ReactNode;
};

const SortableCategoryItem: FC<SortableCategoryItemProps> = ({
  categoryKey,
  categoryName,
  index,
  isCollapsed,
  onToggleCollapse,
  moveCategory,
  children
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [{handlerId}, drop] = useDrop<CategoryDragItem, void, {handlerId: Identifier | null}>({
    accept: CATEGORY_ITEM_TYPE,
    collect: monitor => ({
      handlerId: monitor.getHandlerId()
    }),
    hover: (item, monitor) => {
      const dragIndex = item.index;
      const hoverIndex = index;

      if (shouldPreventHover(containerRef, dragIndex, hoverIndex, monitor)) {
        return;
      }

      moveCategory(dragIndex, hoverIndex);
      item.index = hoverIndex;
    }
  });

  const [{isDragging}, drag, dragPreview] = useDrag(() => ({
    type: CATEGORY_ITEM_TYPE,
    item: {id: categoryKey, index, type: CATEGORY_ITEM_TYPE},
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  }));

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (node) {
        drop(node);
        dragPreview(node);
      }
    },
    [drop, dragPreview]
  );

  const setDragHandleRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        drag(node);
      }
    },
    [drag]
  );

  return (
    <div
      ref={setContainerRef}
      data-handler-id={handlerId ?? undefined}
      style={{opacity: isDragging ? 0.4 : 1}}
      className={bucketNavigationStyles.categoryItem}
    >
      <div
        className={bucketNavigationStyles.catGroupHead}
        onClick={() => onToggleCollapse(categoryKey)}
      >
        <span
          className={`${bucketNavigationStyles.catGroupChevron}${isCollapsed ? ` ${bucketNavigationStyles.catGroupChevronCollapsed}` : ''}`}
        >
          <Icon name="chevronDown" size="sm" />
        </span>
        <span className={bucketNavigationStyles.catGroupLabel}>{categoryName}</span>
        <div ref={setDragHandleRef} className={bucketNavigationStyles.catGroupDrag}>
          <Icon name="grip" size="sm" />
        </div>
      </div>
      {!isCollapsed && (
        <div className={bucketNavigationStyles.catGroupItems}>
          {children}
        </div>
      )}
    </div>
  );
};

const Bucket = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {data: buckets = []} = useGetBucketsQuery();
  const [orderedBuckets, setOrderedBuckets] = useState<BucketNavigationItemData[]>([]);
  const [openBucketId, setOpenBucketId] = useState<string | null>(null);
  const [updateBucketOrder] = useUpdateBucketOrderMutation();
  const previousBucketsRef = useRef<BucketNavigationItemData[] | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const sortedBuckets = useMemo(() => {
    if (!Array.isArray(buckets)) {
      return [];
    }

    return [...buckets].sort((a, b) => {
      const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.title.localeCompare(b.title);
    });
  }, [buckets]);

  const activeBucketId = useMemo(() => {
    const match = location.pathname.match(/^\/bucket\/(.+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  const filteredBuckets = useMemo(() => {
    if (!searchQuery.trim()) {
      return orderedBuckets;
    }

    const q = searchQuery.toLowerCase();
    return orderedBuckets.filter(b => b.title.toLowerCase().includes(q));
  }, [orderedBuckets, searchQuery]);

  useEffect(() => {
    setOrderedBuckets(sortedBuckets as BucketNavigationItemData[]);
  }, [sortedBuckets]);

  useEffect(() => {
    const storedOrder = safeReadCategoryOrder();
    if (!storedOrder.length) {
      return;
    }

    setCategoryOrder(storedOrder);
  }, []);

  const moveBucket = useCallback((fromIndex: number, toIndex: number) => {
    setOrderedBuckets(prevBuckets => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
        return prevBuckets;
      }

      const nextBuckets = [...prevBuckets];
      const [movedBucket] = nextBuckets.splice(fromIndex, 1);

      if (!movedBucket) {
        return prevBuckets;
      }

      nextBuckets.splice(toIndex, 0, movedBucket);

      return nextBuckets;
    });
  }, []);

  const handleNavigateToBucket = useCallback(
    (bucketId: string) => {
      navigate(`/bucket/${bucketId}`);
    },
    [navigate]
  );

  const handleDragStart = useCallback(
    (startIndex: number) => {
      if (!orderedBuckets[startIndex]) {
        previousBucketsRef.current = null;
        return;
      }

      previousBucketsRef.current = orderedBuckets.map(bucket => ({...bucket}));
    },
    [orderedBuckets]
  );

  const handleDropBucket = useCallback(
    async (bucketId: string, finalIndex: number) => {
      const snapshot =
        previousBucketsRef.current?.map(bucket => ({...bucket})) ?? orderedBuckets.map(bucket => ({...bucket}));

      const reorderedBuckets = (() => {
        const nextBuckets = orderedBuckets.map(bucket => ({...bucket}));
        const currentIndex = nextBuckets.findIndex(bucket => bucket._id === bucketId);

        if (currentIndex === -1) {
          return nextBuckets;
        }

        const [movedBucket] = nextBuckets.splice(currentIndex, 1);
        nextBuckets.splice(finalIndex, 0, movedBucket);

        return nextBuckets.map((bucket, index) => ({
          ...bucket,
          order: index
        }));
      })();

      setOrderedBuckets(reorderedBuckets);

      try {
        await Promise.all(
          reorderedBuckets.map(bucket =>
            updateBucketOrder({bucketId: bucket._id, order: bucket.order ?? 0}).unwrap()
          )
        );
      } catch (error) {
        console.error("Failed to update bucket order", error);
        setOrderedBuckets(snapshot);
      } finally {
        previousBucketsRef.current = null;
      }
    },
    [orderedBuckets, updateBucketOrder]
  );

  const handleSetBucketPopupOpen = useCallback((bucketId: string, state: SetStateAction<boolean>) => {
    setOpenBucketId(prevId => {
      const prevIsOpen = prevId === bucketId;
      const nextIsOpen = typeof state === "function" ? state(prevIsOpen) : state;

      if (nextIsOpen) {
        return bucketId;
      }

      return prevIsOpen ? null : prevId;
    });
  }, []);

  const handleToggleCategoryCollapse = useCallback((key: string) => {
    setCollapsedCategories(prev => ({...prev, [key]: !prev[key]}));
  }, []);

  const {grouped, ungrouped: _ungrouped} = useMemo(() => groupBucketsByCategory(orderedBuckets), [orderedBuckets]);
  const {grouped: filteredGrouped, ungrouped: filteredUngrouped} = useMemo(
    () => groupBucketsByCategory(filteredBuckets),
    [filteredBuckets]
  );

  useEffect(() => {
    setCategoryOrder(prevOrder => {
      const groupedNames = grouped.map(group => group.category);
      const filteredPrev = prevOrder.filter(name => groupedNames.includes(name));
      const missing = groupedNames.filter(name => !filteredPrev.includes(name));
      const nextOrder = [...filteredPrev, ...missing];

      if (arraysEqual(prevOrder, nextOrder)) {
        return prevOrder;
      }

      return nextOrder;
    });
  }, [grouped]);

  useEffect(() => {
    persistCategoryOrder(categoryOrder);
  }, [categoryOrder]);

  const moveCategory = useCallback((fromIndex: number, toIndex: number) => {
    setCategoryOrder(prevOrder => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prevOrder.length ||
        toIndex > prevOrder.length
      ) {
        return prevOrder;
      }

      const nextOrder = [...prevOrder];
      const [moved] = nextOrder.splice(fromIndex, 1);
      if (!moved) {
        return prevOrder;
      }
      nextOrder.splice(toIndex, 0, moved);
      return nextOrder;
    });
  }, []);

  const orderedGrouped = useMemo(() => {
    if (!filteredGrouped.length) {
      return [];
    }

    const groupMap = new Map(filteredGrouped.map(group => [group.category, group]));
    const orderedFromStorage = categoryOrder
      .map(categoryName => groupMap.get(categoryName))
      .filter(Boolean) as CategoryGroup[];
    const remainingGroups = filteredGrouped.filter(group => !categoryOrder.includes(group.category));

    return [...orderedFromStorage, ...remainingGroups];
  }, [categoryOrder, filteredGrouped]);

  const renderBucketItem = useCallback(
    (bucket: BucketNavigationItemData, index: number, groupKey: string) => (
      <SortableNavigationItem
        key={bucket._id ?? index}
        id={bucket._id}
        title={bucket.title}
        index={index}
        groupKey={groupKey}
        dndType={BUCKET_ITEM_TYPE}
        iconName="bucket"
        variant="sidebar"
        isActive={activeBucketId === bucket._id}
        activeClassName={bucketNavigationStyles.bucketItemActive}
        moveItem={moveBucket}
        onNavigate={handleNavigateToBucket}
        onDragStart={handleDragStart}
        onDrop={handleDropBucket}
        itemClassName={bucketNavigationStyles.bucketItem}
        titleClassName={bucketNavigationStyles.bucketTitle}
        suffixClassName={bucketNavigationStyles.actionButtons}
        renderSuffix={dragHandleRef => (
          <FlexElement gap={0}>
               <div ref={dragHandleRef}>
              <Button
                variant="icon"
                color="transparent"
                className={bucketNavigationStyles.itemButton}
              >
                <Icon name="grip" size="xs"/>
              </Button>
            </div>
            <BucketNavigatorPopup
              isOpen={openBucketId === bucket._id}
              setIsOpen={state => handleSetBucketPopupOpen(bucket._id, state)}
              bucket={bucket as BucketType}
            />
         
          </FlexElement>
        )}
      />
    ),
    [
      activeBucketId,
      handleDragStart,
      handleDropBucket,
      handleNavigateToBucket,
      handleSetBucketPopupOpen,
      moveBucket,
      openBucketId
    ]
  );

  const groupedCategoryItems = useMemo(
    () =>
      orderedGrouped.map((groupItem, groupIndex) => {
        const categoryName = helperUtils.capitalize(groupItem.category ?? "Uncategorized");

        return (
          <SortableCategoryItem
            key={groupItem.category ?? groupIndex}
            categoryKey={groupItem.category}
            categoryName={categoryName}
            index={groupIndex}
            isCollapsed={collapsedCategories[groupItem.category] ?? false}
            onToggleCollapse={handleToggleCategoryCollapse}
            moveCategory={moveCategory}
          >
            {groupItem.items.map(({bucket, index}) =>
              renderBucketItem(bucket, index, bucket.category ?? groupItem.category ?? UNGROUPED_CATEGORY_KEY)
            )}
          </SortableCategoryItem>
        );
      }),
    [collapsedCategories, handleToggleCategoryCollapse, moveCategory, orderedGrouped, renderBucketItem]
  );


  const handleViewListClick = () => {
    navigate("/diagram");
  };

  const handleClockOutlineClick = () => {
    // TODO: Implement clock outline click
  };


  return (
    <div className={styles.container}>
      <div className={styles.sidebarHead}>
        <div className={styles.sidebarTopRow}>
          <span className={styles.sidebarLabel}>Buckets</span>
          <div className={styles.sidebarActions}>
            <button
              className={styles.iconBtn}
              onClick={handleClockOutlineClick}
              title="History"
            >
              <Icon name="clockOutline" size="sm" />
            </button>
            <button
              className={styles.iconBtn}
              onClick={handleViewListClick}
              title="View"
            >
              <Icon name="gridView" size="sm" />
            </button>
          </div>
        </div>
        <div className={styles.searchBox}>
          <Icon name="search" size="sm" />
          <input
            placeholder="Search buckets…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <div className={bucketNavigationStyles.bucketsItemContainer}>
        {groupedCategoryItems}
        {filteredUngrouped.length > 0 && (
          <>
            {orderedGrouped.length > 0 && (
              <div className={bucketNavigationStyles.uncategorizedLabel}>Uncategorized</div>
            )}
            {filteredUngrouped.map(({bucket, index}) =>
              renderBucketItem(bucket, index, bucket.category ?? UNGROUPED_CATEGORY_KEY)
            )}
          </>
        )}
      </div>

      <AddBucketPopup />
    </div>
  );
};

export default memo(Bucket);
