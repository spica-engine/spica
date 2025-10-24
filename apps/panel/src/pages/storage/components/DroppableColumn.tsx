import {useRef} from "react";
import {useDrop} from "react-dnd";
import {type DirectoryItem, type DragItem, ItemTypes} from "../../../types/storage";
import {validateDrop} from "./utils";
import styles from "./StorageColumns.module.scss";

interface DroppableColumnProps {
  folderPath: string;
  items: DirectoryItem[];
  children: React.ReactNode;
  onDrop: (
    draggedItem: DirectoryItem,
    targetPath: string,
    sourceItems: DirectoryItem[],
    targetItems: DirectoryItem[]
  ) => Promise<boolean>;
  className?: string;
}

export function DroppableColumn({folderPath, items, children, onDrop, className}: DroppableColumnProps) {
  const [{isOver, canDrop}, drop] = useDrop<
    DragItem,
    DirectoryItem,
    {isOver: boolean; canDrop: boolean}
  >({
    accept: ItemTypes.STORAGE_ITEM,
    drop: dragItem => {
      const draggedItem: DirectoryItem = {
        _id: dragItem.id,
        label: dragItem.name,
        fullPath: dragItem.fullPath,
        content: {
          type: dragItem.isDirectory ? "inode/directory" : "application/octet-stream",
          size: 0
        },
        name: dragItem.name,
        url: "",
        isActive: false
      };

      const targetPath = folderPath.endsWith("/") ? folderPath : folderPath + "/";

      const sourceItems = items.filter(item => {
        const itemParent = item.fullPath.substring(0, item.fullPath.lastIndexOf("/") + 1);
        return itemParent === dragItem.parentPath;
      });

      void onDrop(draggedItem, targetPath, sourceItems, items).catch(err => {
        console.error("onDrop failed", err);
      });

      return undefined;
    },
    canDrop: dragItem => {
      const oldParent = dragItem.parentPath;
      const newParent = folderPath.endsWith("/") ? folderPath : folderPath + "/";
      const draggedItem: DirectoryItem = {
        _id: dragItem.id,
        label: dragItem.name,
        fullPath: dragItem.fullPath,
        content: {
          type: dragItem.isDirectory ? "inode/directory" : "application/octet-stream",
          size: 0
        },
        name: dragItem.name,
        url: "",
        isActive: false
      };

      return validateDrop(draggedItem, oldParent, newParent, items);
    },
    collect: monitor => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  });

  const active = isOver && canDrop === true;
  const notAllowedDrop = isOver && !canDrop;
  const ref = useRef(null);
  drop(ref);

  return (
    <div
      ref={ref}
      className={`${active ? styles.droppableColumnActive : ""} ${notAllowedDrop ? styles.notAllowedDrop : ""} ${styles.droppableColumn} ${className || ""}`}
    >
      {children}
    </div>
  );
}
