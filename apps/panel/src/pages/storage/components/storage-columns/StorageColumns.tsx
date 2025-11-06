import {useRef, useEffect, useMemo, memo, type DragEventHandler} from "react";
import {useDrop, useDrag} from "react-dnd";
import {FlexElement, Spinner, Icon, Text} from "oziko-ui-kit";
import {useAppSelector, useAppDispatch} from "../../../../store/hook";
import {selectDirectory, setDirectory, handleFolderClick as handleFolderClickAction} from "../../../../store";
import {useUploadFilesMutation} from "../../../../store/api/storageApi";
import {useDragAndDrop} from "../../hooks/useDragAndDrop";
import {useStorageDataSync} from "../../hooks/useStorageDataSync";
import {useFileOperations} from "../../hooks/useFileOperations";
import {validateDrop} from "../../utils";
import {ROOT_PATH} from "../../constants";
import {DnDItemTypes} from "../../../../hooks/useTypedDragLayer";
import type {
  DirectoryItem,
  TypeDirectories,
  TypeDirectoryDepth,
  DragItem
} from "../../../../types/storage";
import styles from "./StorageColumns.module.scss";
import { DraggableStorageItem } from "../droppable-item/DroppableItem";

interface StorageColumnsProps {
  setPreviewFile: (file?: DirectoryItem) => void;
  handleClosePreview: () => void;
  previewFile?: DirectoryItem;
}

interface DraggableStorageItemProps {
  item: DirectoryItem;
  children: React.ReactNode;
}


interface StorageItemProps {
  item: DirectoryItem;
  onFolderClick?: (folderName: string) => void;
  onFileClick: (file?: DirectoryItem) => void;
  isActive: boolean;
}

const StorageItem = memo(({item, onFolderClick, onFileClick, isActive}: StorageItemProps) => {
  const itemName = item.label || item.name;
  const isFolder = item?.content?.type === "inode/directory";
  const displayName = isFolder ? itemName.slice(0, -1) : itemName;

  const handleClick = () => {
    if (isFolder) {
      onFolderClick?.(itemName);
    } else {
      onFileClick(isActive ? undefined : item);
    }
  };

  return (
    <DraggableStorageItem item={item}>
      <FlexElement
        onClick={handleClick}
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
});

StorageItem.displayName = "StorageItem";
interface StorageColumnProps {
  items: DirectoryItem[];
  directory: TypeDirectories;
  previewFileId?: string;
  prefix: string;
  depth: TypeDirectoryDepth;
  onFolderClick: (folderName: string, fullPath: string, depth: TypeDirectoryDepth, isActive: boolean) => void;
  onFileClick: (file?: DirectoryItem) => void;
  onUploadComplete?: (file: any) => void;
}

const StorageColumn = memo(({
  items,
  directory,
  previewFileId,
  prefix,
  depth,
  onFolderClick,
  onFileClick,
  onUploadComplete
}: StorageColumnProps) => {
  const [uploadFiles] = useUploadFilesMutation();

  const handleDragOver: DragEventHandler<HTMLDivElement> = e => {
    e.preventDefault();
  };

  const handleDrop: DragEventHandler<HTMLDivElement> = async e => {
    e.preventDefault();
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
      alignment="left"
      gap={10}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {items.length > 0 ? (
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
              onFolderClick={folderName => onFolderClick(folderName, fullPath, depth, isActive)}
              onFileClick={onFileClick}
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
});

StorageColumn.displayName = "StorageColumn";

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

const DroppableColumn = memo(({folderPath, items, children, onDrop, className}: DroppableColumnProps) => {
  const [{isOver, canDrop}, drop] = useDrop<
    DragItem,
    DirectoryItem,
    {isOver: boolean; canDrop: boolean}
  >({
    accept: DnDItemTypes.STORAGE_ITEM,
    drop: dragItem => {
      const draggedItem: DirectoryItem = {
        _id: dragItem.id,
        label: dragItem.name,
        fullPath: dragItem.fullPath,
        content: {
          type: dragItem.type,
          size: dragItem.size
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

      onDrop(draggedItem, targetPath, sourceItems, items).catch(err => {
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
          type: dragItem.type,
          size: dragItem.size
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

  const dropStyles: React.CSSProperties = {
    minHeight: "100px",
    transition: "background-color var(--transition-duration) ease",
    backgroundColor: active
      ? "var(--color-menu-contrast)"
      : notAllowedDrop
      ? "var(--color-error-light)"
      : "var(--color-transparent)",
    opacity: notAllowedDrop ? 0.6 : 1,
    cursor: notAllowedDrop ? "not-allowed" : "default"
  };

  return (
    <div ref={ref} style={dropStyles} className={className}>
      {children}
    </div>
  );
});

DroppableColumn.displayName = "DroppableColumn";

export function StorageItemColumns({
  setPreviewFile,
  handleClosePreview,
  previewFile
}: StorageColumnsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();
  const directory = useAppSelector(selectDirectory);

  const handleSetDirectory = (dirs: TypeDirectories) => {
    dispatch(setDirectory(dirs));
  };

  useStorageDataSync(directory, handleSetDirectory);
  const {onUploadComplete} = useFileOperations(directory, handleSetDirectory, setPreviewFile);
  const {handleDrop} = useDragAndDrop(directory, handleSetDirectory);

  const handleFolderClick = (
    folderName: string,
    fullPath: string,
    directoryDepth: TypeDirectoryDepth,
    wasActive: boolean
  ) => {
    handleClosePreview();
    dispatch(
      handleFolderClickAction({
        folderName,
        fullPath,
        directoryDepth,
        wasActive,
        isFilteringOrSearching: false
      })
    );
  };

  const visibleDirectories = useMemo(
    () =>
      directory
        .filter(dir => dir.currentDepth)
        .sort((a, b) => (a.currentDepth || 0) - (b.currentDepth || 0)),
    [directory]
  );

  const maxDepth = useMemo(
    () => Math.max(...visibleDirectories.map(dir => dir.currentDepth || 0), 0),
    [visibleDirectories]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkScrollable = () => {
      if (container.scrollWidth > container.clientWidth) {
        container.scrollTo({left: container.scrollWidth, behavior: "smooth"});
      }
    };

    checkScrollable();

    const resizeObserver = new ResizeObserver(checkScrollable);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [visibleDirectories]);

  return (
    <div ref={containerRef} className={styles.container}>
      <FlexElement className={styles.columns} gap={0}>
        {visibleDirectories.map(dir => {
          const orderedItems = [...(dir.items || [])].sort((a, b) => {
            const aIsDir = a.content?.type === "inode/directory";
            const bIsDir = b.content?.type === "inode/directory";
            if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
            const firstName = a.label || a.name;
            const secondName = b.label || b.name;
            return firstName.localeCompare(secondName);
          });

          const folderPath =
            dir.fullPath === ROOT_PATH
              ? ""
              : dir.fullPath.split("/").filter(Boolean).join("/") + "/";

          const columnClassName = `${styles.storageItemColumnContainer} ${
            maxDepth === dir.currentDepth ? styles.lastColumn : ""
          }`;

          return dir.items ? (
            <DroppableColumn
              key={dir.fullPath}
              folderPath={folderPath}
              items={orderedItems}
              onDrop={handleDrop}
              className={columnClassName}
            >
              <StorageColumn
                items={orderedItems}
                directory={directory}
                previewFileId={previewFile?._id}
                prefix={folderPath}
                depth={dir.currentDepth!}
                onFolderClick={handleFolderClick}
                onFileClick={setPreviewFile}
                onUploadComplete={onUploadComplete}
              />
            </DroppableColumn>
          ) : (
            <div className={styles.columnLoaderContainer} key={dir.fullPath}>
              <Spinner />
            </div>
          );
        })}
      </FlexElement>
    </div>
  );
}

