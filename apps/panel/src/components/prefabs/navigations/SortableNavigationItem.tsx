import {useCallback, useRef, type FC, type ReactNode} from "react";
import {useDrag, useDrop} from "react-dnd";
import type {Identifier, XYCoord} from "dnd-core";
import {FluidContainer, Icon, Text, type IconName} from "oziko-ui-kit";

type NavigationDragItem = {
  id: string;
  index: number;
  groupKey: string;
  type: string;
};

export const shouldPreventHover = (
  containerRef: React.RefObject<HTMLElement | null>,
  dragIndex: number,
  hoverIndex: number,
  monitor: {getClientOffset: () => XYCoord | null}
): boolean => {
  if (dragIndex === hoverIndex) {
    return true;
  }

  if (!containerRef.current) {
    return true;
  }

  const hoverBoundingRect = containerRef.current.getBoundingClientRect();
  const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

  const clientOffset = monitor.getClientOffset();
  if (!clientOffset) {
    return true;
  }

  const hoverClientY = clientOffset.y - hoverBoundingRect.top;

  if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
    return true;
  }

  if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
    return true;
  }

  return false;
};

export type SortableNavigationItemProps = {
  id: string;
  title: string;
  index: number;
  groupKey: string;
  dndType: string;
  iconName: IconName;
  moveItem: (from: number, to: number) => void;
  onNavigate: (id: string) => void;
  onDragStart: (index: number) => void;
  onDrop: (id: string, index: number) => void;
  itemClassName?: string;
  titleClassName?: string;
  suffixClassName?: string;
  renderSuffix?: (dragHandleRef: (node: HTMLDivElement | null) => void) => ReactNode;
};

const SortableNavigationItem: FC<SortableNavigationItemProps> = ({
  id,
  title,
  index,
  groupKey,
  dndType,
  iconName,
  moveItem,
  onNavigate,
  onDragStart,
  onDrop,
  itemClassName,
  titleClassName,
  suffixClassName,
  renderSuffix
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const groupKeyRef = useRef(groupKey);
  groupKeyRef.current = groupKey;

  const [{handlerId}, drop] = useDrop<NavigationDragItem, void, {handlerId: Identifier | null}>({
    accept: dndType,
    collect: monitor => ({
      handlerId: monitor.getHandlerId()
    }),
    hover: (item, monitor) => {
      if (item.groupKey !== groupKeyRef.current) {
        return;
      }

      const dragIndex = item.index;
      const hoverIndex = indexRef.current;

      if (shouldPreventHover(containerRef, dragIndex, hoverIndex, monitor)) {
        return;
      }

      moveItem(dragIndex, hoverIndex);
      item.index = hoverIndex;
    }
  });

  const [{isDragging}, drag, dragPreview] = useDrag(() => ({
    type: dndType,
    item: () => {
      onDragStart(indexRef.current);
      return {id, index: indexRef.current, groupKey: groupKeyRef.current, type: dndType};
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
    onNavigate(id);
  }, [id, onNavigate]);

  return (
    <div
      ref={setContainerRef}
      data-handler-id={handlerId ?? undefined}
      style={{opacity: isDragging ? 0.4 : 1}}
      className={itemClassName}
    >
      <FluidContainer
        onClick={handleClick}
        dimensionX={"fill"}
        dimensionY={36}
        mode="fill"
        prefix={{
          children: <Icon name={iconName} size="md" />
        }}
        root={{
          children: (
            <Text
              size="medium"
              dimensionX={"fill"}
              className={titleClassName}
            >
              {title}
            </Text>
          ),
          alignment: "leftCenter",
        }}
        suffix={
          renderSuffix
            ? {
                children: renderSuffix(setDragHandleRef),
                className: suffixClassName
              }
            : undefined
        }
      />
    </div>
  );
};

export default SortableNavigationItem;
