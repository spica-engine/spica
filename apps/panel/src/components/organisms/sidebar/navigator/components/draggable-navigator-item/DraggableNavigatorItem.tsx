import {
  useRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  type Ref
} from "react";
import {useDrag, useDragLayer, useDrop} from "react-dnd";
import {getEmptyImage} from "react-dnd-html5-backend";
import {useNavigatorItemClick} from "../../hooks/useNavigatorItemClick";
import {useNavigatorItemSelection} from "../../hooks/useNavigatorItemSelection";
import NavigatorItem from "../../../../../molecules/navigator-item/NavigatorItem";
import styles from "./DraggableNavigatorItem.module.scss";
import type {TypeNavigatorItem} from "../../../../../../types/sidebar";
import { useTypedDragLayer } from "src/hooks/useTypedDragLayer";
import { DnDItemTypes } from "src/hooks/useTypedDragLayer";

type TypeDraggableItemProps = {
  item: TypeNavigatorItem & {index: number};
  completeMoving: (identifier: string, order: number) => void;
  ref: Ref<HTMLDivElement>;
  justDropped: boolean;
  setJustDropped: React.Dispatch<React.SetStateAction<boolean>>;
};

export const DraggableItem = ({
  item,
  completeMoving,
  ref,
  justDropped,
  setJustDropped
}: TypeDraggableItemProps) => {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const isCurrentlySelected = useNavigatorItemSelection(item);
  const handleClick = useNavigatorItemClick(item, isCurrentlySelected);

  const [{handlerId}, drop] = useDrop({
    accept: DnDItemTypes.NAVIGATOR_ITEM,
    collect: monitor => ({
      handlerId: monitor.getHandlerId()
    })
  });

  const [, drag, preview] = useDrag({
    type: DnDItemTypes.NAVIGATOR_ITEM,
    item: () => item, 
    end: draggedItem => {
      setJustDropped(true);
      completeMoving(draggedItem._id, draggedItem.index);
    }
  });

  const {dragLayerItem, isDragging} = useTypedDragLayer(
    DnDItemTypes.NAVIGATOR_ITEM,
    monitor => ({
    
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
      prefixIcon={item.icon}
    />
  );
};