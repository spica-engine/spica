import React, {memo, type DragEventHandler} from "react";
import {FlexElement, type TypeAlignment, type TypeFile, Text} from "oziko-ui-kit";
import {useUploadFilesMutation} from "../../../store/api/storageApi";
import styles from "./StorageColumns.module.scss";
import {
  type DirectoryItem,
  type TypeDirectoryDepth,
  type TypeDirectories,
} from "src/types/storage";

interface StorageItemColumnProps {
  items: DirectoryItem[];
  handleFolderClick: (
    folderName: string,
    fullPath: string,
    isActive: boolean,
    depth: TypeDirectoryDepth,
  ) => void;
  setPreviewFile: (file?: DirectoryItem) => void;
  depth: TypeDirectoryDepth;
  directory: TypeDirectories;
  previewFileId?: string;
  prefix: string;
  onUploadComplete?: (file: TypeFile & {prefix?: string}) => void;
  isDraggingDisabled: boolean;
  StorageItem: React.ComponentType<{
    item: DirectoryItem;
    onFolderClick?: (folderName: string) => void;
    onFileClick: (file?: DirectoryItem) => void;
    isActive: boolean;
  }>;
}

export const StorageItemColumn = memo(
  ({
    items,
    handleFolderClick,
    setPreviewFile,
    depth,
    directory,
    previewFileId,
    prefix,
    onUploadComplete,
    isDraggingDisabled,
    StorageItem
  }: StorageItemColumnProps) => {
    const [uploadFiles] = useUploadFilesMutation();

    const handleDragOver: DragEventHandler<HTMLDivElement> = e => {
      if (isDraggingDisabled) return;
      e.preventDefault();
    };

    const handleDrop: DragEventHandler<HTMLDivElement> = async e => {
      e.preventDefault();
      if (isDraggingDisabled) return;
      const files = e.dataTransfer.files;

      if (files && files.length > 0) {
        try {
          const filesWithPrefix = Array.from(files).map(file => {
            const fileName = prefix + file.name;
            const encodedFileName = encodeURIComponent(fileName);
            return new File([file], encodedFileName, {type: file.type});
          });

          const dataTransfer = new DataTransfer();
          filesWithPrefix.forEach(file => dataTransfer.items.add(file));

          const response = await uploadFiles({files: dataTransfer.files});
          const uploadedFile = response?.data?.[0] as DirectoryItem | undefined;
          if (uploadedFile) {
            onUploadComplete?.({...uploadedFile, prefix});
          }
        } catch (error) {
          console.error("File upload failed:", error);
        }
      }
    };

    return (
      <FlexElement
        className={styles.storageItemColumn}
        direction="vertical"
        alignment={"left" as TypeAlignment}
        gap={10}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {items.length ? (
          items.map(item => {
            const isFolder = item?.content?.type === "inode/directory";
            const fullPath = item.fullPath || item.name;
            const isActive = isFolder
              ? directory.find(i => i.fullPath === fullPath)?.isActive || false
              : previewFileId === item._id;

            return (
              <StorageItem
                key={item._id}
                item={item}
                onFolderClick={folderName =>
                  handleFolderClick(folderName, fullPath, isActive, depth)
                }
                onFileClick={setPreviewFile}
                isActive={isActive}
              />
            );
          })
        ) : (
          <Text size="large" variant="secondary" className={styles.noItemsText}>
            No items found.
          </Text>
        )}
      </FlexElement>
    );
  }
);
