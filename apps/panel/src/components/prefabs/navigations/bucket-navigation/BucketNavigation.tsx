/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {
  Icon,
  Text,
  helperUtils,
  Accordion,
  FlexElement,
  FluidContainer,
  Button
} from "oziko-ui-kit";
import styles from "../Navigation.module.scss";
import bucketNavigationStyles from "./BucketNavigation.module.scss";

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

import {useNavigate} from "react-router-dom";
import {useGetBucketsQuery} from "../../../../store/api";
import {useUpdateBucketOrderMutation, type BucketType} from "../../../../store/api/bucketApi";
import {useDrag, useDrop} from "react-dnd";
import type {Identifier, XYCoord} from "dnd-core";
import AddBucketPopup from "../../../../components/molecules/add-bucket-popup/AddBucketPopup";

import BucketNavigatorPopup from "../../../molecules/bucket-navigator-popup/BucketNavigatorPopup";

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

type DragItem = {
  id: string;
  index: number;
  groupKey: string;
  type: typeof BUCKET_ITEM_TYPE;
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


type SortableBucketItemProps = {
  bucket: BucketNavigationItemData;
  index: number;
  groupKey: string;
  moveBucket: (from: number, to: number) => void;
  onNavigate: (id: string) => void;
  onDragStart: (index: number) => void;
  onDrop: (id: string, index: number) => void;
  isPopupOpen: boolean;
  onPopupStateChange: (state: SetStateAction<boolean>) => void;
};

const SortableBucketItem: FC<SortableBucketItemProps> = ({
  bucket,
  index,
  groupKey,
  moveBucket,
  onNavigate,
  onDragStart,
  onDrop,
  isPopupOpen,
  onPopupStateChange
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [{handlerId}, drop] = useDrop<DragItem, void, {handlerId: Identifier | null}>({
    accept: BUCKET_ITEM_TYPE,
    collect: monitor => ({
      handlerId: monitor.getHandlerId()
    }),
    hover: (item, monitor) => {
      if (item.groupKey !== groupKey) {
        return;
      }

      if (!containerRef.current) {
        return;
      }

      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = containerRef.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        return;
      }

      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      moveBucket(dragIndex, hoverIndex);
      item.index = hoverIndex;
    }
  });

  const [{isDragging}, drag, dragPreview] = useDrag(() => ({
    type: BUCKET_ITEM_TYPE,
    item: () => {
      onDragStart(index);
      return {id: bucket._id, index, groupKey, type: BUCKET_ITEM_TYPE};
    },
    end: draggedItem => {
      if (!draggedItem) {
        return;
      }

      onDrop(draggedItem.id, draggedItem.index);
    },
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

  const handleClick = useCallback(() => {
    onNavigate(bucket._id);
  }, [bucket._id, onNavigate]);

  return (
    <div
      ref={setContainerRef}
      data-handler-id={handlerId ?? undefined}
      style={{opacity: isDragging ? 0.4 : 1}}
      className={bucketNavigationStyles.bucketItem}
    >
      <FluidContainer
        onClick={handleClick}
        dimensionX={"fill"}
        dimensionY={36}
        mode="fill"
        prefix={{
          children: <Icon name="bucket" size="md" />
        }}
        root={{
          children: (
            <Text
              size="medium"
              dimensionX={"fill"}
              className={bucketNavigationStyles.bucketTitle}
            >
              {bucket.title}
            </Text>
          ),
          alignment: "leftCenter",
        }}

        suffix={{
          children: (
            <FlexElement gap={10}>
              <div ref={setDragHandleRef}>
                <Button
                  variant="icon"
                  color="transparent"
                  className={bucketNavigationStyles.itemButton}
                >
                  <Icon name="dragHorizontalVariant" size="sm" />
                </Button>
              </div>
              <BucketNavigatorPopup
                className={bucketNavigationStyles.itemButton}
                isOpen={isPopupOpen}
                setIsOpen={onPopupStateChange}
                bucket={bucket as BucketType}
              />
            </FlexElement>
          ),
          className: bucketNavigationStyles.actionButtons
        }}
      />
    </div>
  );
};

type SortableCategoryItemProps = {
  categoryKey: string;
  index: number;
  moveCategory: (fromIndex: number, toIndex: number) => void;
  children: (options: {setDragHandleRef: (node: HTMLDivElement | null) => void}) => ReactNode;
};

const SortableCategoryItem: FC<SortableCategoryItemProps> = ({categoryKey, index, moveCategory, children}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [{handlerId}, drop] = useDrop<CategoryDragItem, void, {handlerId: Identifier | null}>({
    accept: CATEGORY_ITEM_TYPE,
    collect: monitor => ({
      handlerId: monitor.getHandlerId()
    }),
    hover: (item, monitor) => {
      if (!containerRef.current) {
        return;
      }

      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = containerRef.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        return;
      }

      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
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
      {children({setDragHandleRef})}
    </div>
  );
};

const BucketNavigation = () => {
  const navigate = useNavigate();
  const {data: buckets = []} = useGetBucketsQuery();
  const [orderedBuckets, setOrderedBuckets] = useState<BucketNavigationItemData[]>([]);
  const [openBucketId, setOpenBucketId] = useState<string | null>(null);
  const [updateBucketOrder] = useUpdateBucketOrderMutation();
  const previousBucketsRef = useRef<BucketNavigationItemData[] | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

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

  const {grouped, ungrouped} = useMemo(() => groupBucketsByCategory(orderedBuckets), [orderedBuckets]);

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
    if (!grouped.length) {
      return [];
    }

    const groupMap = new Map(grouped.map(group => [group.category, group]));
  const orderedFromStorage = categoryOrder
    .map(categoryName => groupMap.get(categoryName))
    .filter(Boolean) as CategoryGroup[];
    const remainingGroups = grouped.filter(group => !categoryOrder.includes(group.category));

    return [...orderedFromStorage, ...remainingGroups];
  }, [categoryOrder, grouped]);

  const renderBucketItem = useCallback(
    (bucket: BucketNavigationItemData, index: number, groupKey: string) => (
      <SortableBucketItem
        key={bucket._id ?? index}
        bucket={bucket}
        index={index}
        groupKey={groupKey}
        moveBucket={moveBucket}
        onNavigate={handleNavigateToBucket}
        onDragStart={handleDragStart}
        onDrop={handleDropBucket}
        isPopupOpen={openBucketId === bucket._id}
        onPopupStateChange={state => handleSetBucketPopupOpen(bucket._id, state)}
      />
    ),
    [
      handleDragStart,
      handleDropBucket,
      handleNavigateToBucket,
      handleSetBucketPopupOpen,
      moveBucket,
      openBucketId
    ]
  );

  const groupedAccordionItems = useMemo(
    () =>
      orderedGrouped.map((groupItem, groupIndex) => {
        const categoryName = helperUtils.capitalize(groupItem.category ?? "Uncategorized");

        const items = [
          {
            title: categoryName,
            content: (
              <>
                {groupItem.items.map(({bucket, index}) =>
                  renderBucketItem(bucket, index, bucket.category ?? groupItem.category ?? UNGROUPED_CATEGORY_KEY)
                )}
              </>
            ),
            icon: null
          }
        ];

        return (
          <SortableCategoryItem
            key={groupItem.category ?? groupIndex}
            categoryKey={groupItem.category}
            index={groupIndex}
            moveCategory={moveCategory}
          >
            {({setDragHandleRef}) => (
              <Accordion
                items={[
                  {
                    ...items[0],
                    icon: (
                      <FlexElement gap={4}>
                        <div ref={setDragHandleRef} className={bucketNavigationStyles.categoryDragHandle}>
                          <Icon name="dragHorizontalVariant" />
                        </div>
                        <Icon name="dotsVertical" />
                      </FlexElement>
                    )
                  }
                ]}
                defaultActiveIndex={-1}
                headerClassName={bucketNavigationStyles.accordionHeader}
                className={`${bucketNavigationStyles.accordion}`}
                openClassName={bucketNavigationStyles.accordionOpen}
                gap={0}
              />
            )}
          </SortableCategoryItem>
        );
      }),
    [moveCategory, orderedGrouped, renderBucketItem]
  );


  const handleViewListClick = () => {
    navigate("/diagram");
  };

  const handleClockOutlineClick = () => {
    // TODO: Implement clock outline click
  };


  return (
    <div className={styles.container}>
      <FluidContainer
        dimensionX={"fill"}
        mode="fill"
        className={styles.header}
        root={{
          children: (
            <Text dimensionX={"fill"} size="large">
              Buckets
            </Text>
          )
        }}
        suffix={{
          children: (
            <FlexElement gap={10}>
              <Button
                className={styles.button}
                variant="icon"
                color="transparent"
                onClick={() => handleClockOutlineClick()}
              >
                <Icon name="clockOutline" className={styles.rootItemIcon} />
              </Button>
              <Button
                className={styles.button}
                variant="icon"
                color="transparent"
                onClick={() => handleViewListClick()}
              >
                <Icon name="viewList" className={styles.rootItemIcon} />
              </Button>
            </FlexElement>
          )
        }}
      />
      <div className={bucketNavigationStyles.bucketsItemContainer}>
        {groupedAccordionItems}
        {ungrouped.map(({bucket, index}) =>
          renderBucketItem(bucket, index, bucket.category ?? UNGROUPED_CATEGORY_KEY)
        )}
      </div>

      <AddBucketPopup />
    </div>
  );
};

export default memo(BucketNavigation);
