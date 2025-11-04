import { NavigatorItem } from "oziko-ui-kit";
import { useMemo, useEffect } from "react";
import { useDragLayer } from "react-dnd";
import styles from "./DragPreviewNavigatorItem.module.scss";
import { DnDItemTypes, useTypedDragLayer } from "../../../../../../hooks/useTypedDragLayer";

type TypeCustomDragLayerProps = {
  itemRefs: (HTMLDivElement | null)[];
  moveItem: (itemIndex: number, hoverIndex: number) => void;
};

export const CustomDragLayer = ({itemRefs, moveItem}: TypeCustomDragLayerProps) => {
  const {item, currentOffset, initialOffset} = useTypedDragLayer(
    DnDItemTypes.NAVIGATOR_ITEM,
    monitor => ({
      item: monitor.getItem(),
      currentOffset: monitor.getSourceClientOffset(),
      initialOffset: monitor.getInitialSourceClientOffset()
    })
  );

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

  if (!item?.isDragging) return null;

  return (
    <div className={styles.dragLayer}>
      <div style={{transform, WebkitTransform: transform}}>
        <NavigatorItem
          label={item?.title ?? ""}
          suffixIcons={[{name: "dragHorizontalVariant"}]}
          className={`${styles.navigatorItem} ${item.className ?? ""}`}
          prefixIcon={item.icon}
        />
      </div>
    </div>
  );
};