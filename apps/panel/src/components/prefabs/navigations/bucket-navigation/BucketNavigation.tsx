import {
  Icon,
  Text,
  type IconName,
  helperUtils,
  Accordion,
  FlexElement,
  FluidContainer
} from "oziko-ui-kit";
import styles from "../Navigation.module.scss";
import bucketNavigationStyles from "./BucketNavigation.module.scss";
import {Button} from "oziko-ui-kit";
import {memo, useCallback, useEffect, useMemo, useRef, useState, type FC} from "react";
import type {
  NavigatorItemGroup,
  TypeNavigatorItem,
  TypeNavigatorHeader
} from "../../../../types/sidebar";

import {useNavigate} from "react-router-dom";
import {useGetBucketsQuery} from "../../../../store/api";
import {useUpdateBucketOrderMutation, type BucketType} from "../../../../store/api/bucketApi";
import NavigatorItem from "../../../../components/molecules/navigator-item/NavigatorItem";
import { useDrag, useDrop } from "react-dnd";
import type { Identifier, XYCoord } from "dnd-core";
import AddBucketPopup from "../../../../components/molecules/add-bucket-popup/AddBucketPopup";

import BucketNavigatorPopup from "../../../molecules/bucket-navigator-popup/BucketNavigatorPopup";

const BUCKET_ITEM_TYPE = "BUCKET_NAVIGATION_ITEM";

type BucketNavigationItemData = {
  _id: string;
  title: string;
  order?: number;
  [key: string]: unknown;
};

type DragItem = {
  id: string;
  index: number;
  type: typeof BUCKET_ITEM_TYPE;
};

const groupObjectsByCategory = (items: TypeNavigatorItem[]) => {
  const groupedMap = new Map<string, TypeNavigatorItem[]>();
  const ungrouped: TypeNavigatorItem[] = [];
  items.forEach(obj => {
    if (obj.category) {
      if (!groupedMap.has(obj.category)) {
        groupedMap.set(obj.category, []);
      }
      groupedMap.get(obj.category)!.push(obj);
    } else {
      ungrouped.push(obj);
    }
  });

  const grouped = Array.from(groupedMap.values());

  return {
    grouped,
    ungrouped
  };
};

// type TypeNavigatorProps = {
//   header?: TypeNavigatorHeader;
//   items?: NavigatorItemGroup;
//   button?: {
//     title: string;
//     icon: IconName;
//     onClick: () => void;
//   };
// };

type SortableBucketItemProps = {
  bucket: BucketNavigationItemData;
  index: number;
  moveBucket: (from: number, to: number) => void;
  onNavigate: (id: string) => void;
  onDragStart: (index: number) => void;
  onDrop: (id: string, index: number) => void;
};

const SortableBucketItem: FC<SortableBucketItemProps> = ({
  bucket,
  index,
  moveBucket,
  onNavigate,
  onDragStart,
  onDrop
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [{handlerId}, drop] = useDrop<DragItem, void, {handlerId: Identifier | null}>({
    accept: BUCKET_ITEM_TYPE,
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

      moveBucket(dragIndex, hoverIndex);
      item.index = hoverIndex;
    }
  });

  const [{isDragging}, drag, dragPreview] = useDrag(() => ({
    type: BUCKET_ITEM_TYPE,
    item: () => {
      onDragStart(index);
      return {id: bucket._id, index, type: BUCKET_ITEM_TYPE};
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
              <Button
                variant="icon"
                color="transparent"
                className={bucketNavigationStyles.itemButton}
              >
                <Icon name="dotsVertical" size="sm" />
                <BucketNavigatorPopup isOpen={true} setIsOpen={() => {}} bucket={bucket as BucketType} />
              </Button>
            </FlexElement>
          ),
          className: bucketNavigationStyles.actionButtons
        }}
      />
    </div>
  );
};

const BucketNavigation = () => {
  const navigate = useNavigate();
  const {data: buckets = []} = useGetBucketsQuery();
  const [orderedBuckets, setOrderedBuckets] = useState<BucketNavigationItemData[]>([]);
  const [updateBucketOrder] = useUpdateBucketOrderMutation();
  const previousBucketsRef = useRef<BucketNavigationItemData[] | null>(null);

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

  // const {grouped, ungrouped} = useMemo(() => groupObjectsByCategory(items?.items ?? []), [items]);

  // const accordionItems = useMemo(
  //   () =>
  //     grouped.map((item, index) => {
  //       const title = helperUtils.capitalize(item?.[0]?.category ?? "");
  //       const content = (
  //         <>
  //           {item.map((item: TypeNavigatorItem, index: number) => (
  //             <AccordionNavigatorItem key={item._id} item={item} index={index} />
  //           ))}
  //         </>
  //       );

  //       const icon = (
  //         <>
  //           <Icon name="dragHorizontalVariant" />
  //           <Icon name="dotsVertical" />
  //         </>
  //       );
  //       const items = [{title, content, icon}];

  //       return (
  //         <Accordion
  //           key={index}
  //           items={items}
  //           headerClassName={styles.accordionHeader}
  //           className={`${styles.accordion} accordion`}
  //           openClassName={styles.accordionOpen}
  //           gap={0}
  //         />
  //       );
  //     }),
  //   [grouped, items]
  // );

 

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
        {orderedBuckets.map((bucket, index) => (
          <SortableBucketItem
            key={bucket._id ?? index}
            bucket={bucket}
            index={index}
            moveBucket={moveBucket}
            onNavigate={handleNavigateToBucket}
            onDragStart={handleDragStart}
            onDrop={handleDropBucket}
          />
        ))}
      </div>

      <AddBucketPopup />
    </div>
  );
};

export default memo(BucketNavigation);
