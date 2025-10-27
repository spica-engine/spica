import { useDragLayer, type DragLayerMonitor } from 'react-dnd';

export const DnDItemTypes = {
  NAVIGATOR_ITEM: 'NAVIGATOR_ITEM',
  STORAGE_ITEM: 'STORAGE_ITEM',
} as const;


export function useTypedDragLayer<T extends string, R = any>(
  type: T,
  selector?: (monitor: DragLayerMonitor) => R
) {
  return useDragLayer((monitor) => {
    const itemType = monitor.getItemType();
    const matches = itemType === type;

    if (!matches) return {} as R;

    const baseData = {
      itemType,
      item: monitor.getItem(),
      isDragging: monitor.isDragging() && monitor.getItemType() === type,
      currentOffset: monitor.getSourceClientOffset(),
      differenceFromInitialOffset: monitor.getDifferenceFromInitialOffset(),
    };

    // If the caller provided a selector, merge/replace
    return selector ? { ...baseData, ...selector(monitor) } : (baseData as unknown as R);
  });
}
