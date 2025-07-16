import {FluidContainer, Icon, Text, type IconName, helperUtils} from "oziko-ui-kit";
import styles from "./Navigator.module.scss";
import {Button, Accordion} from "oziko-ui-kit";
import NavigatorItem from "../../../molecules/navigator-item/NavigatorItem";
import React, {memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef} from "react";
import {useNavigate} from "react-router-dom";
import {DndProvider, useDrag, useDragLayer, useDrop, type XYCoord} from "react-dnd";
import {getEmptyImage, HTML5Backend} from "react-dnd-html5-backend";
import type {TypeNavigatorItems} from "../SideBar";
import {useBucket} from "../../../../contexts/BucketContext";
import type {BucketType} from "src/services/bucketService";

type TypeNavigatorProps = {
  header?: TypeNavigatorHeader;
  items?: {
    items: TypeNavigatorItems[] | BucketType[];
    setter:
      | React.Dispatch<React.SetStateAction<TypeNavigatorItems[] | null>>
      | React.Dispatch<React.SetStateAction<BucketType[] | null>>;
  };
  button?: {
    title: string;
    icon: IconName;
    onClick: () => void;
  };
  addNewButtonText?: string;
};

type TypeNavigatorHeaderProps = Omit<TypeNavigatorProps, "addNewButtonText">;

export type TypeNavigatorHeader = {
  name?: string;
  buttons?: {
    icon: IconName;
    onClick: () => void;
  }[];
};

const NavigatorHeader = ({header}: TypeNavigatorHeaderProps) => {
  return (
    <FluidContainer
      dimensionX="fill"
      mode="fill"
      alignment="leftCenter"
      root={{
        children: <Text className={styles.title}>{header?.name}</Text>,
        alignment: "leftCenter"
      }}
      suffix={{
        children: header?.buttons?.map((button, index) => (
          <Button
            key={index}
            variant="text"
            color="transparent"
            className={styles.icon}
            onClick={button.onClick}
          >
            <Icon name={button.icon} size={18} />
          </Button>
        ))
      }}
      className={styles.header}
    />
  );
};

export function CustomDragLayer({
  itemRefs,
  moveItem
}: {
  itemRefs: (HTMLDivElement | null)[];
  moveItem: (itemIndex: number, hoverIndex: number) => void;
}) {
  const {item, isDragging, currentOffset, initialOffset} = useDragLayer(monitor => ({
    item: monitor.getItem(),
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getSourceClientOffset(),
    initialOffset: monitor.getInitialSourceClientOffset()
  }));

  const hoverIndex = itemRefs.findIndex(ref => {
    if (!ref || !currentOffset) return false;
    const rect = ref.getBoundingClientRect();
    return currentOffset.y >= rect.top && currentOffset.y <= rect.bottom;
  });

  useEffect(() => {
    if (hoverIndex !== -1 && item.index !== hoverIndex) {
      moveItem(item.index, hoverIndex);
      item.index = hoverIndex;
    }
  }, [hoverIndex, item?.index, moveItem]);

  const transform = `translate(${(initialOffset?.x ?? 0) - 156}px, ${currentOffset?.y}px)`;

  if (!isDragging) return null;

  return (
    <div className={styles.dragLayer}>
      <div style={{transform, WebkitTransform: transform}}>
        <NavigatorItem
          label={item?.title ?? ""}
          prefixIcon={item?.icon}
          suffixIcons={[{name: "dragHorizontalVariant"}, {name: "dotsVertical"}]}
          className={styles.ungrouped}
        />
      </div>
    </div>
  );
}

type DraggableItemProps = {
  item: (TypeNavigatorItems & {index: number}) | (BucketType & {index: number});
  completeMoving: ({bucketId, order}: {bucketId: string; order: number}) => void;
};

const DraggableItem = React.forwardRef<HTMLDivElement, DraggableItemProps>(
  ({item, completeMoving}, ref) => {
    const navigate = useNavigate();
    const innerRef = useRef<HTMLDivElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);

    const [{handlerId, isOver}, drop] = useDrop({
      accept: "NAVIGATOR_ITEM",
      collect: monitor => ({
        handlerId: monitor.getHandlerId(),
        isOver: monitor.isOver()
      })
    });

    if (item.title === "New Bucket 2") {
      console.log("isOver: ", isOver);
    }
    const [, drag, preview] = useDrag({
      type: "NAVIGATOR_ITEM",
      item: () => item,
      end: draggedItem => {
        completeMoving({bucketId: draggedItem._id, order: draggedItem.index});
      }
    });

    // We intentionally use useDragLayer instead useDrag for isDragging
    // because useDrag's isDragging can be inconsistent. useDragLayer is more reliable.
    const {dragLayerItem, isDragging} = useDragLayer(monitor => ({
      dragLayerItem: monitor.getItem(),
      isDragging: monitor.isDragging()
    }));

    useEffect(() => {
      const timeout = setTimeout(() => {
        preview(getEmptyImage(), {captureDraggingState: true});
      });
      return () => clearTimeout(timeout);
    }, [preview]);

    const opacity = useMemo(() => {
      if (dragLayerItem?._id === item._id) return isDragging ? 0 : 1;
      return 1;
    }, [dragLayerItem?._id, item._id, isDragging]);

    useImperativeHandle(ref, () => innerRef.current!);

    drop(innerRef);
    drag(buttonRef);
    return (
      <NavigatorItem
        data-handler-id={handlerId}
        ref={innerRef}
        label={item?.title ?? ""}
        prefixIcon={item?.icon}
        style={{opacity}}
        suffixIcons={[{name: "dragHorizontalVariant", ref: buttonRef}, {name: "dotsVertical"}]}
        onClick={() => {
          navigate(`/${item?.section}/${item?._id}`);
        }}
        className={styles.ungrouped}
      />
    );
  }
);

const ReorderableList = ({
  items,
  setItems
}: {
  items: TypeNavigatorItems[];
  setItems: React.Dispatch<React.SetStateAction<TypeNavigatorItems[]>>;
}) => {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const setItemRef = (el: HTMLDivElement | null, index: number) => {
    itemRefs.current[index] = el;
  };

  const {changeBucketOrder} = useBucket();
  const moveItem = useCallback((from: number, to: number) => {
    setItems((prev: TypeNavigatorItems[]) => {
      const updated = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      return updated;
    });
  }, []);

  return (
    <DndProvider backend={HTML5Backend}>
      <CustomDragLayer itemRefs={itemRefs.current} moveItem={moveItem} />
      {items.map((item, index) => (
        <DraggableItem
          key={item._id}
          item={{...item, index}}
          completeMoving={changeBucketOrder}
          ref={el => setItemRef(el, index)}
        />
      ))}
    </DndProvider>
  );
};

const Navigator = ({header, items, button, addNewButtonText}: TypeNavigatorProps) => {
  const navigate = useNavigate();
  const groupObjectsByCategory = (object: {items: any[]}) => {
    const groupedMap = new Map<string, TypeNavigatorItems[]>();
    const ungrouped: TypeNavigatorItems[] = [];
    object.items.forEach(obj => {
      if (obj.category) {
        if (!groupedMap.has(obj.category)) {
          groupedMap.set(obj.category, []);
        }
        groupedMap.get(obj.category)!.push(obj);
      } else {
        ungrouped.push(obj);
      }
    });

    return {
      grouped: Array.from(groupedMap.values()),
      ungrouped
    };
  };

  const {grouped, ungrouped} = groupObjectsByCategory({
    items: items?.items ?? []
  });
  const accordionItems = grouped?.map(item => ({
    title: helperUtils.capitalize("item[0].category"),
    content: (
      <>
        {item.map((item: any, index: number) => (
          <NavigatorItem
            key={item?._id}
            label={item?.title}
            prefix={{children: <Icon name={item?.icon} />}}
            prefixIcon={item?.icon}
            suffixIcons={[{name: "dragHorizontalVariant"}, {name: "dotsVertical"}]}
            onClick={() => {
              navigate(`/${item?.section}/${item?._id}`);
            }}
          />
        ))}
      </>
    ),
    icon: (
      <>
        <Icon name="dragHorizontalVariant" />
        <Icon name="dotsVertical" />
      </>
    )
  }));

  return (
    <div className={styles.navigation}>
      <NavigatorHeader header={header} />
      <div className={styles.items}>
        <Accordion
          items={accordionItems}
          headerClassName={styles.header}
          gap={0}

          //TODO: add hoverable api
        />
        {Array.isArray(ungrouped) && typeof items?.setter === "function" && (
          <ReorderableList
            setItems={items.setter as React.Dispatch<React.SetStateAction<TypeNavigatorItems[]>>}
            items={ungrouped as TypeNavigatorItems[]}
          />
        )}
        {addNewButtonText && (
          <Button className={styles.addNewButton} color="transparent" variant="text">
            <Icon name="plus" size="xs" />
            <Text className={styles.noLineHeight} size="medium">
              {addNewButtonText}
            </Text>
          </Button>
        )}
      </div>
      {button && (
        <Button color="transparent" variant="text">
          <Icon name={button.icon} />
          <Text className={styles.noLineHeight}>{button.title}</Text>
        </Button>
      )}
    </div>
  );
};

export default memo(Navigator);
