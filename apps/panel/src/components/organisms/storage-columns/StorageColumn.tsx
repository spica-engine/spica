import {useDrop} from "react-dnd";
import {ItemTypes, getCanDropChecks, getParentPath, type DragItem} from "./StorageColumnHooks";
import type {DirectoryItem, TypeDirectories, TypeDirectoryDepth} from "./StorageColumns";
import {memo, useMemo, useRef, type DragEventHandler} from "react";
import {FlexElement, type TypeAlignment, type TypeFile, Text} from "oziko-ui-kit";
import {useUploadFilesMutation} from "../../../store/api/storageApi";
import styles from "./StorageColumns.module.scss";
import {StorageItem} from "./StorageItem";

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

function DroppableColumn({folderPath, items, children, onDrop, className}: DroppableColumnProps) {
  const [{isOver, canDrop}, drop] = useDrop<DragItem, boolean, {isOver: boolean; canDrop: boolean}>(
    {
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

        return getCanDropChecks().every(check => check(oldParent, newParent, draggedItem, items));
      },
      collect: monitor => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop()
      })
    }
  );

  const active = isOver && canDrop;
  const ref = useRef(null);
  drop(ref);

  return (
    <div
      ref={ref}
      className={`${active ? styles.droppableColumnActive : ""} ${styles.droppableColumn} ${className || ""}`}
    >
      {children}
    </div>
  );
}

interface StorageItemColumnProps {
  items?: DirectoryItem[];
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
  handleDrop: (
    draggedItem: DirectoryItem,
    targetFolderPath: string,
    sourceItems: DirectoryItem[],
    targetItems: DirectoryItem[]
  ) => Promise<boolean>;
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
    handleDrop: handleDrop_
  }: StorageItemColumnProps) => {
    const [uploadFiles] = useUploadFilesMutation();

    const orderedItems = useMemo(() => {
      if (!items) return [];
      return [...items].sort((a, b) => {
        const aIsDir = a.content?.type === "inode/directory";
        const bIsDir = b.content?.type === "inode/directory";
        if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }, [items]);

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
      <DroppableColumn
        folderPath={prefix}
        items={orderedItems || []}
        onDrop={handleDrop_}
        className={styles.storageItemColumnContainer}
      >
        <FlexElement
          className={styles.storageItemColumn}
          direction="vertical"
          alignment={"left" as TypeAlignment}
          gap={10}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {orderedItems.length ? (
            orderedItems.map(item => {
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
      </DroppableColumn>
    );
  }
);
