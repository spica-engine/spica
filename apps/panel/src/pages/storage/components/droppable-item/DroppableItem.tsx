import {useRef} from "react";
import {useDrag} from "react-dnd";
import {type DirectoryItem, type DragItem} from "../../../../types/storage";
import styles from "./DroppableItem.module.scss";
import {DnDItemTypes} from "../../../../hooks/useTypedDragLayer";

interface DraggableStorageItemProps {
  item: DirectoryItem;
  children: React.ReactNode;
}

export function DraggableStorageItem({item, children}: DraggableStorageItemProps) {
  const isDirectory = item.content?.type === "inode/directory";

  const pathWithoutTrailingSlash = isDirectory ? item.fullPath.slice(0, -1) : item.fullPath;

  const calculatedParentPath = pathWithoutTrailingSlash.substring(
    0,
    pathWithoutTrailingSlash.lastIndexOf("/") + 1
  );

  const parentPath = calculatedParentPath === "" ? "/" : calculatedParentPath;

  const [{isDragging}, drag] = useDrag<DragItem, unknown, {isDragging: boolean}>({
    type: DnDItemTypes.STORAGE_ITEM,
    item: {
      id: item._id || "",
      name: item.label as string,
      fullPath: item.fullPath,
      isDirectory: item.content?.type === "inode/directory",
      parentPath
    },
    collect: monitor => ({
      isDragging: monitor.isDragging()
    }),
    canDrag: () => true
  });

  const ref = useRef(null);
  drag(ref);
  return (
    <div
      ref={ref}
      className={`${styles.draggableStorageItem} ${isDragging ? styles.draggingStorageItem : ""}`}
    >
      {children}
    </div>
  );
}
