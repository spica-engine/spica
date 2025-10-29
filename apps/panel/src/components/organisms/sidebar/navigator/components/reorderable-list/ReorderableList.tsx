import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  type Ref
} from "react";
import {useDrag, useDragLayer, useDrop, DndProvider} from "react-dnd";
import {getEmptyImage, HTML5Backend} from "react-dnd-html5-backend";
import {useNavigatorItemClick} from "../../hooks/useNavigatorItemClick";
import {useNavigatorItemSelection} from "../../hooks/useNavigatorItemSelection";
import type {NavigatorItemGroup, TypeNavigatorItems} from "../../../SideBar";
import NavigatorItem from "../../../../../molecules/navigator-item/NavigatorItem";
import styles from "./ReorderableList.module.scss";

type TypeDraggableItemProps = {
  item: TypeNavigatorItems & {index: number};
  completeMoving: (identifier: string, order: number) => void;
  ref: Ref<HTMLDivElement>;
  justDropped: boolean;
  setJustDropped: React.Dispatch<React.SetStateAction<boolean>>;
};

type TypeCustomDragLayerProps = {
  itemRefs: (HTMLDivElement | null)[];
  moveItem: (itemIndex: number, hoverIndex: number) => void;
};

type TypeReorderableListProps = NavigatorItemGroup;

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
          suffixElements={item.suffixElements}
          className={`${styles.navigatorItem} ${item.className ?? ""}`}
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
      className={`${styles.navigatorItem} ${isDragging ? styles.globalDragActive : ""} ${justDropped ? styles.justDropped : ""} ${isCurrentlySelected ? styles.selected : ""} ${item.className ?? ""}`}
      suffixElements={item.suffixElements}
    />
  );
};

export const ReorderableList = ({
  items,
  onOrderChange,
  completeOrderChange
}: TypeReorderableListProps) => {
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
