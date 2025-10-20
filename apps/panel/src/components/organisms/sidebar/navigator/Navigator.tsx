import {FluidContainer, Icon, Text, type IconName, helperUtils, Accordion} from "oziko-ui-kit";
import styles from "./Navigator.module.scss";
import {Button} from "oziko-ui-kit";
import NavigatorItem from "../../../molecules/navigator-item/NavigatorItem";
import React, {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref
} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {DndProvider, useDrag, useDragLayer, useDrop} from "react-dnd";
import {getEmptyImage, HTML5Backend} from "react-dnd-html5-backend";
import type {ReorderableItemGroup, TypeNavigatorItems} from "../SideBar";
import type {BucketType} from "src/store/api/bucketApi";
import AddBucketPopup from "../../../../components/molecules/add-bucket-popup/AddBucketPopup";

type TypeNavigatorProps = {
  header?: TypeNavigatorHeader;
  items?: ReorderableItemGroup;
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

type TypeDraggableItemProps = {
  item: (TypeNavigatorItems & {index: number}) | (BucketType & {index: number});
  completeMoving: (identifier: string, order: number) => void;
  ref: Ref<HTMLDivElement>;
  justDropped: boolean;
  setJustDropped: React.Dispatch<React.SetStateAction<boolean>>;
};

type TypeCustomDragLayerProps = {
  itemRefs: (HTMLDivElement | null)[];
  moveItem: (itemIndex: number, hoverIndex: number) => void;
};

type TypeReorderableListProps = ReorderableItemGroup;

// Custom hooks to eliminate code duplication
const useNavigatorItemSelection = (itemId: string) => {
  const params = useParams();
  return useMemo(() => {
    return params.bucketId === itemId;
  }, [params.bucketId, itemId]);
};

const useNavigatorItemClick = (item: any, isCurrentlySelected: boolean) => {
  const navigate = useNavigate();
  return useCallback(() => {
    if (item.section === "storage") navigate("/storage");
    if (!isCurrentlySelected) {
      navigate(`/${item?.section}/${item?._id}`);
    }
  }, [navigate, item?.section, item?._id, isCurrentlySelected]);
};

// Component for accordion navigator items to eliminate duplication
const AccordionNavigatorItem = ({item, index}: {item: any; index: number}) => {
  const isCurrentlySelected = useNavigatorItemSelection(item._id);
  const handleClick = useNavigatorItemClick(item, isCurrentlySelected);

  return (
    <div className={styles.accordionItemContainer} key={index}>
      <NavigatorItem
        key={item?._id}
        label={item?.title}
        prefix={{children: <Icon name={"help"} />}}
        suffixIcons={[{name: "dragHorizontalVariant"}]}
        onClick={handleClick}
        bucket={item}
        className={`${styles.navigatorItem} ${isCurrentlySelected ? styles.selected : ""}`}
      />
    </div>
  );
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

const CustomDragLayer = ({itemRefs, moveItem}: TypeCustomDragLayerProps) => {
  const {item, isDragging, currentOffset, initialOffset} = useDragLayer(monitor => ({
    item: monitor.getItem(),
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getSourceClientOffset(),
    initialOffset: monitor.getInitialSourceClientOffset()
  }));

  const hoverIndex = useMemo(
    () =>
      itemRefs.findIndex(ref => {
        if (!ref || !currentOffset) return false;
        const rect = ref.getBoundingClientRect();
        return currentOffset.y >= rect.top && currentOffset.y <= rect.bottom;
      }),
    [itemRefs, currentOffset?.x, currentOffset?.y]
  );

  useEffect(() => {
    if (hoverIndex !== -1 && item.index !== hoverIndex) {
      moveItem(item.index, hoverIndex);
      item.index = hoverIndex;
    }
  }, [hoverIndex, item?.index, moveItem]);

  const transform = useMemo(
    () => `translate(${(initialOffset?.x ?? 0) - 153}px, ${currentOffset?.y}px)`,
    [initialOffset?.x, currentOffset?.y]
  );

  if (!isDragging) return null;

  return (
    <div className={styles.dragLayer}>
      <div style={{transform, WebkitTransform: transform}}>
        <NavigatorItem
          label={item?.title ?? ""}
          suffixIcons={[{name: "dragHorizontalVariant"}]}
          className={styles.navigatorItem}
          bucket={item}
        />
      </div>
    </div>
  );
};

const DraggableItem = ({
  item,
  completeMoving,
  ref,
  justDropped,
  setJustDropped
}: TypeDraggableItemProps) => {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Use custom hooks to eliminate code duplication
  const isCurrentlySelected = useNavigatorItemSelection(item._id);
  const handleClick = useNavigatorItemClick(item, isCurrentlySelected);

  const [{handlerId}, drop] = useDrop({
    accept: "NAVIGATOR_ITEM",
    collect: monitor => ({
      handlerId: monitor.getHandlerId()
    })
  });

  const [, drag, preview] = useDrag({
    type: "NAVIGATOR_ITEM",
    item: () => item,
    end: draggedItem => {
      setJustDropped(true);
      completeMoving(draggedItem._id, draggedItem.index);
    }
  });

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
      style={{opacity}}
      suffixIcons={[{name: "dragHorizontalVariant", ref: buttonRef}]}
      onClick={handleClick}
      className={`${styles.navigatorItem} ${isDragging ? styles.globalDragActive : ""} ${justDropped ? styles.justDropped : ""} ${isCurrentlySelected ? styles.selected : ""}`}
      bucket={item as BucketType}
      icon={item.icon as IconName}
    />
  );
};

const ReorderableList = ({items, onOrderChange, completeOrderChange}: TypeReorderableListProps) => {
  const [justDropped, setJustDropped] = useState(false);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const setItemRef = useCallback((el: HTMLDivElement | null, index: number) => {
    itemRefs.current[index] = el;
  }, []);

  useEffect(() => {
    const handleMouseMove = () => setJustDropped(false);
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <DndProvider backend={HTML5Backend}>
      <CustomDragLayer itemRefs={itemRefs.current} moveItem={onOrderChange} />
      {items.map((item, index) => (
        <DraggableItem
          key={item._id}
          item={{...item, index}}
          completeMoving={completeOrderChange}
          ref={(el: HTMLDivElement) => setItemRef(el, index)}
          justDropped={justDropped}
          setJustDropped={setJustDropped}
        />
      ))}
    </DndProvider>
  );
};

const Navigator = ({header, items, button, addNewButtonText}: TypeNavigatorProps) => {
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
    title: helperUtils.capitalize(item?.[0]?.category ?? ""),
    content: (
      <>
        {item.map((item: any, index: number) => (
          <AccordionNavigatorItem key={item._id} item={item} index={index} />
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
        {accordionItems.map((item, index) => (
          <Accordion
            key={index}
            items={[item]}
            headerClassName={styles.accordionHeader}
            className={`${styles.accordion} accordion`}
            openClassName={styles.accordionOpen}
            gap={0}
          />
        ))}

        {Array.isArray(ungrouped) && items && (
          <ReorderableList
            onOrderChange={items.onOrderChange}
            completeOrderChange={items.completeOrderChange}
            items={ungrouped as TypeNavigatorItems[]}
          />
        )}
        {addNewButtonText && <AddBucketPopup text={addNewButtonText} />}
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
