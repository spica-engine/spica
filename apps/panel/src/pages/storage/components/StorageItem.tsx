import {memo} from "react";
import {FlexElement, Icon, Text} from "oziko-ui-kit";
import {type DirectoryItem} from "../../../types/storage";
import styles from "./StorageItem.module.scss";
import { DraggableStorageItem } from "./DroppableItem";

interface StorageItemProps {
  item: DirectoryItem;
  onFolderClick?: (folderName: string) => void;
  onFileClick: (file?: DirectoryItem) => void;
  isActive: boolean;
}

export const StorageItem = memo(
  ({item, onFolderClick, onFileClick, isActive}: StorageItemProps) => {
    const itemName = item.label || item.name;
    const isFolder = item?.content?.type === "inode/directory";
    const displayName = isFolder ? itemName.slice(0, -1) : itemName;
    const handleFolderClick = () => onFolderClick?.(itemName);
    const handleFileClick = () => onFileClick(isActive ? undefined : item);
    return (
      <DraggableStorageItem item={item}>
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
