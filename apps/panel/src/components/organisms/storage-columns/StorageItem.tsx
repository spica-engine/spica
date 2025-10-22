import {useDrag} from "react-dnd";
import type {DirectoryItem, TypeDirectory} from "./StorageColumns";
import {type DragItem, ItemTypes} from "./StorageColumnHooks";
import {memo, useRef} from "react";
import {FlexElement, Icon, Text} from "oziko-ui-kit";
import styles from "./StorageColumns.module.scss";

interface DraggableStorageItemProps {
  item: DirectoryItem;
  children: React.ReactNode;
}

function DraggableStorageItem({item, children}: DraggableStorageItemProps) {
  const isDirectory = item.content?.type === "inode/directory";

  const pathWithoutTrailingSlash = isDirectory ? item.fullPath.slice(0, -1) : item.fullPath;

  const calculatedParentPath = pathWithoutTrailingSlash.substring(
    0,
    pathWithoutTrailingSlash.lastIndexOf("/") + 1
  );

  const parentPath = calculatedParentPath === "" ? "/" : calculatedParentPath;

  const [{isDragging}, drag] = useDrag<DragItem, unknown, {isDragging: boolean}>({
    type: ItemTypes.STORAGE_ITEM,
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

interface StorageItemProps {
  item: DirectoryItem | TypeDirectory;
  onFolderClick?: (folderName: string) => void;
  onFileClick: (file?: DirectoryItem) => void;
  isActive: boolean;
}

export const StorageItem = memo(
  ({item, onFolderClick, onFileClick, isActive}: StorageItemProps) => {
    const itemName = (item as TypeDirectory).label || (item as DirectoryItem).name;
    const isFolder = item?.content?.type === "inode/directory";
    const displayName = isFolder ? itemName.slice(0, -1) : itemName;
    const handleFolderClick = () => onFolderClick?.(itemName);
    const handleFileClick = () => onFileClick(isActive ? undefined : (item as DirectoryItem));
    return (
      <DraggableStorageItem item={item as DirectoryItem}>
        <FlexElement
          onClick={isFolder ? handleFolderClick : handleFileClick}
          className={`${styles.storageItem} ${isActive ? styles.activeStorageItem : ""}`}
          gap={10}
        >
          <Icon
            name={isFolder ? "folder" : "fileDocument"}
            size={14}
            className={styles.storageItemIcon}
          />
          <Text className={styles.storageItemText} size="medium">
            {displayName}
          </Text>
        </FlexElement>
      </DraggableStorageItem>
    );
  }
);
