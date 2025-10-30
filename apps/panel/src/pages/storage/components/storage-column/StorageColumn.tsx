import React, {memo, type DragEventHandler} from "react";
import {FlexElement, type TypeAlignment, type TypeFile, Text, CircularProgress} from "oziko-ui-kit";
import {useUploadFilesMutation} from "../../../../store/api/storageApi";
import styles from "./StorageColumn.module.scss";
import {
  type DirectoryItem,
  type TypeDirectoryDepth,
  type TypeDirectories
} from "../../../../types/storage";
import {UploadOverlay} from "./components/upload-overlay/UploadOverlay";

interface StorageItemColumnProps {
  items: DirectoryItem[];
  handleFolderClick: (
    folderName: string,
    fullPath: string,
    depth: TypeDirectoryDepth,
    isActive: boolean
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
    const [uploadFiles, {isLoading, error}] = useUploadFilesMutation();
    const [progress, setProgress] = React.useState(0);

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

          const response = await uploadFiles({files: dataTransfer.files, onProgress: setProgress});
          const uploadedFile = response?.data?.[0] as DirectoryItem | undefined;
          if (uploadedFile) {
            onUploadComplete?.({...uploadedFile, prefix});
          }
        } catch (error) {
          console.error("File upload failed:", error);
        } finally {
          setProgress(0);
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
        <UploadOverlay loading={isLoading} progress={progress} error={error} />
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
                  handleFolderClick(folderName, fullPath, depth, isActive)
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
