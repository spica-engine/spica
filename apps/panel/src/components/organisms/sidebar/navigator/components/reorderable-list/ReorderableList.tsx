import {useState, useRef, useCallback, useEffect} from "react";
import type {NavigatorItemGroup} from "../../../../../../types/sidebar";
import {DraggableItem} from "../draggable-navigator-item/DraggableNavigatorItem";
import {CustomDragLayer} from "../drag-preview-navigator-item/DragPreviewNavigatorItem";

type TypeReorderableListProps = NavigatorItemGroup;

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
    <>
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
    </>
  );
};
