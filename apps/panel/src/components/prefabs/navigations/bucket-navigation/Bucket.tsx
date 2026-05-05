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
  Button,
  Popover,
  Input,
  Modal
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

import {useNavigate} from "react-router-dom";
import {useGetBucketsQuery} from "../../../../store/api";
import {useUpdateBucketOrderMutation, useChangeBucketCategoryMutation, type BucketType} from "../../../../store/api/bucketApi";
import {useDrag, useDrop} from "react-dnd";
import type {Identifier} from "dnd-core";
import AddBucketPopup from "../../../molecules/add-bucket-popup/AddBucketPopup";
import BucketNavigatorPopup from "../../../molecules/bucket-navigator-popup/BucketNavigatorPopup";
import SortableNavigationItem, {shouldPreventHover} from "../SortableNavigationItem";
import Confirmation from "../../../molecules/confirmation/Confirmation";

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
  index: number;
  moveCategory: (fromIndex: number, toIndex: number) => void;
  children: (options: {setDragHandleRef: (node: HTMLDivElement | null) => void}) => ReactNode;
};

const SortableCategoryItem: FC<SortableCategoryItemProps> = ({categoryKey, index, moveCategory, children}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef(index);
  indexRef.current = index;

  const [{handlerId}, drop] = useDrop<CategoryDragItem, void, {handlerId: Identifier | null}>({
    accept: CATEGORY_ITEM_TYPE,
    collect: monitor => ({
      handlerId: monitor.getHandlerId()
    }),
    hover: (item, monitor) => {
      const dragIndex = item.index;
      const hoverIndex = indexRef.current;

      if (shouldPreventHover(containerRef, dragIndex, hoverIndex, monitor)) {
        return;
      }

      moveCategory(dragIndex, hoverIndex);
      item.index = hoverIndex;
    }
  });

  const [{isDragging}, drag, dragPreview] = useDrag(() => ({
    type: CATEGORY_ITEM_TYPE,
    item: () => ({id: categoryKey, index: indexRef.current, type: CATEGORY_ITEM_TYPE}),
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  }));

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (node) {
        drop(node);
        dragPreview(node.querySelector(" & > div > div > div"));
      }
    },
    [drop, dragPreview, isDragging]
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

type CategoryNavigatorPopupProps = {
  categoryName: string;
  isOpen: boolean;
  setIsOpen: (state: SetStateAction<boolean>) => void;
  onRename: (newName: string) => Promise<void>;
  onDelete: () => Promise<void>;
};

const CategoryNavigatorPopup: FC<CategoryNavigatorPopupProps> = ({
  categoryName,
  isOpen,
  setIsOpen,
  onRename,
  onDelete
}) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editValue, setEditValue] = useState(categoryName);
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleOpenEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(categoryName);
    setEditError("");
    setIsOpen(false);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteError(null);
    setIsOpen(false);
    setIsDeleteOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editValue.trim()) {
      setEditError("Category name cannot be empty.");
      return;
    }
    setEditLoading(true);
    setEditError("");
    try {
      await onRename(editValue.trim());
      setIsEditOpen(false);
    } catch (err: any) {
      setEditError(err?.data?.message ?? err?.message ?? "Failed to rename category.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await onDelete();
      setIsDeleteOpen(false);
    } catch (err: any) {
      setDeleteError(err?.data?.message ?? err?.message ?? "Failed to delete category.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className={bucketNavigationStyles.categoryPopupContainer}>
      <Popover
        open={isOpen}
        contentProps={{className: bucketNavigationStyles.categoryPopoverContainer}}
        onClose={() => setIsOpen(false)}
        content={
          <FlexElement
            dimensionX={160}
            direction="vertical"
            className={bucketNavigationStyles.categoryPopoverContent}
          >
            <Button
              containerProps={{alignment: "leftCenter", dimensionX: "fill"}}
              color="default"
              onClick={handleOpenEdit}
              className={bucketNavigationStyles.categoryPopoverButton}
            >
              <Icon name="pencil" />
              <Text>Edit category</Text>
            </Button>
            <Button
              containerProps={{alignment: "leftCenter", dimensionX: "fill"}}
              color="default"
              onClick={handleOpenDelete}
              className={bucketNavigationStyles.categoryPopoverButton}
            >
              <Icon name="delete" className={bucketNavigationStyles.deleteCategoryIcon} />
              <Text variant="danger">Delete category</Text>
            </Button>
          </FlexElement>
        }
      >
        <Button
          onClick={e => {
            e.stopPropagation();
            setIsOpen(prev => !prev);
          }}
          color="transparent"
          variant="icon"
        >
          <Icon name="dotsVertical" size="sm" />
        </Button>
      </Popover>

      {isEditOpen && (
        <Modal
          showCloseButton={false}
          onClose={() => setIsEditOpen(false)}
          className={bucketNavigationStyles.categoryEditModal}
          isOpen
          onClick={e => e.stopPropagation()}
        >
          <div className={bucketNavigationStyles.categoryEditContainer}>
            <div className={bucketNavigationStyles.categoryEditHeader}>
              <Text className={bucketNavigationStyles.categoryEditHeaderText}>EDIT CATEGORY</Text>
            </div>
            <div className={bucketNavigationStyles.categoryEditBody}>
              <div className={bucketNavigationStyles.categoryEditInputContainer}>
                <Icon name="formatQuoteClose" size="md" />
                <Input
                  className={bucketNavigationStyles.categoryEditInput}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  placeholder="Category name"
                />
              </div>
              {editError && (
                <Text variant="danger" className={bucketNavigationStyles.categoryEditErrorText}>
                  {editError}
                </Text>
              )}
            </div>
            <div className={bucketNavigationStyles.categoryEditFooter}>
              <Button onClick={handleSaveEdit} disabled={editLoading} loading={editLoading}>
                <Icon name="save" />
                <Text>Save</Text>
              </Button>
              <Button variant="text" onClick={() => setIsEditOpen(false)} disabled={editLoading}>
                <Icon name="close" />
                <Text>Cancel</Text>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isDeleteOpen && (
        <Confirmation
          title="DELETE CATEGORY"
          description={
            <>
              This will ungroup all buckets in <strong>{categoryName}</strong>. The buckets
              themselves will not be deleted.
            </>
          }
          confirmLabel={
            <>
              <Icon name="delete" />
              Delete
            </>
          }
          cancelLabel={
            <>
              <Icon name="close" />
              Cancel
            </>
          }
          showInput={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setIsDeleteOpen(false);
            setDeleteError(null);
          }}
          loading={deleteLoading}
          error={deleteError}
        />
      )}
    </div>
  );
};

const Bucket = () => {
  const navigate = useNavigate();
  const {data: buckets = []} = useGetBucketsQuery();
  const [orderedBuckets, setOrderedBuckets] = useState<BucketNavigationItemData[]>([]);
  const [openBucketId, setOpenBucketId] = useState<string | null>(null);
  const [updateBucketOrder] = useUpdateBucketOrderMutation();
  const [changeBucketCategory] = useChangeBucketCategoryMutation();
  const previousBucketsRef = useRef<BucketNavigationItemData[] | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

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

  const handleSetCategoryPopupOpen = useCallback((categoryName: string, state: SetStateAction<boolean>) => {
    setOpenCategoryId(prevId => {
      const prevIsOpen = prevId === categoryName;
      const nextIsOpen = typeof state === "function" ? state(prevIsOpen) : state;
      if (nextIsOpen) return categoryName;
      return prevIsOpen ? null : prevId;
    });
  }, []);

  const handleRenameCategory = useCallback(
    async (oldName: string, newName: string) => {
      const targets = orderedBuckets.filter(b => b.category === oldName);
      await Promise.all(
        targets.map(b => changeBucketCategory({bucketId: b._id, category: newName}).unwrap())
      );
    },
    [orderedBuckets, changeBucketCategory]
  );

  const handleDeleteCategory = useCallback(
    async (categoryName: string) => {
      const targets = orderedBuckets.filter(b => b.category === categoryName);
      await Promise.all(
        targets.map(b => changeBucketCategory({bucketId: b._id, category: ""}).unwrap())
      );
    },
    [orderedBuckets, changeBucketCategory]
  );

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
      <SortableNavigationItem
        key={bucket._id ?? index}
        id={bucket._id}
        title={bucket.title}
        index={index}
        groupKey={groupKey}
        dndType={BUCKET_ITEM_TYPE}
        iconName="bucket"
        moveItem={moveBucket}
        onNavigate={handleNavigateToBucket}
        onDragStart={handleDragStart}
        onDrop={handleDropBucket}
        itemClassName={bucketNavigationStyles.bucketItem}
        titleClassName={bucketNavigationStyles.bucketTitle}
        suffixClassName={bucketNavigationStyles.actionButtons}
        renderSuffix={dragHandleRef => (
          <FlexElement gap={10}>
            <div ref={dragHandleRef}>
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
              isOpen={openBucketId === bucket._id}
              setIsOpen={state => handleSetBucketPopupOpen(bucket._id, state)}
              bucket={bucket as BucketType}
            />
          </FlexElement>
        )}
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
                        <CategoryNavigatorPopup
                          categoryName={groupItem.category}
                          isOpen={openCategoryId === groupItem.category}
                          setIsOpen={state => handleSetCategoryPopupOpen(groupItem.category, state)}
                          onRename={newName => handleRenameCategory(groupItem.category, newName)}
                          onDelete={() => handleDeleteCategory(groupItem.category)}
                        />
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
    [moveCategory, orderedGrouped, renderBucketItem, openCategoryId, handleSetCategoryPopupOpen, handleRenameCategory, handleDeleteCategory]
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

export default memo(Bucket);
