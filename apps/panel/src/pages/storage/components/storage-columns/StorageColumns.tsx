import {FlexElement, Spinner, type TypeFile} from "oziko-ui-kit";
import styles from "./StorageColumns.module.scss";
import {useMemo, useRef, useEffect} from "react";
import {ROOT_PATH} from "../../constants";
import {StorageItemColumn} from "../storage-column/StorageColumn";
import type {DirectoryItem, TypeDirectories, TypeDirectoryDepth} from "../../../../types/storage";
import {useDragAndDrop} from "../../hooks/useDragAndDrop";
import {DroppableColumn} from "../droppable-column/DroppableColumn";
import {StorageItem} from "../storage-item/StorageItem";

interface StorageItemColumnsProps {
  handleFolderClick: (
    folderName: string,
    fullPath: string,
    directoryDepth: TypeDirectoryDepth,
    wasActive: boolean
  ) => void;
  setPreviewFile: (file: DirectoryItem | undefined) => void;
  directory: TypeDirectories;
  setDirectory: (dirs: TypeDirectories) => void;
  previewFile?: DirectoryItem;
  onUploadComplete?: (file: TypeFile & {prefix?: string}) => void;
  isFilteringOrSearching?: boolean;
  isLoading: boolean;
}

export function StorageItemColumns({
  handleFolderClick,
  setPreviewFile,
  directory,
  setDirectory,
  previewFile,
  onUploadComplete,
  isFilteringOrSearching = false,
  isLoading
}: StorageItemColumnsProps) {
  const {handleDrop} = useDragAndDrop(directory, setDirectory);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleDirectories = useMemo(
    () =>
      directory
        .filter(dir => dir.currentDepth)
        .sort((a, b) => (a.currentDepth || 0) - (b.currentDepth || 0)),
    [directory]
  );

  const maxDepth = useMemo(() => {
    return Math.max(...visibleDirectories.map(dir => dir.currentDepth || 0), 0);
  }, [visibleDirectories]);

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

    return () => {
      resizeObserver.disconnect();
    };
  }, [visibleDirectories]);

  return (
    <div ref={containerRef} className={styles.container}>
      <FlexElement className={styles.columns} gap={0}>
        {isLoading && isFilteringOrSearching ? (
          <div className={styles.columnLoaderContainer}>
            <Spinner />
          </div>
        ) : (
          visibleDirectories.map(dir => {
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

            return dir.items ? (
              <DroppableColumn
                folderPath={folderPath}
                items={orderedItems || []}
                onDrop={handleDrop}
                key={dir.fullPath}
                className={`${styles.storageItemColumnContainer} ${maxDepth === dir.currentDepth ? styles.lastColumn : ""}`}
              >
                <StorageItemColumn
                  items={orderedItems || []}
                  handleFolderClick={handleFolderClick}
                  setPreviewFile={setPreviewFile}
                  depth={dir.currentDepth!}
                  directory={directory}
                  previewFileId={previewFile?._id}
                  prefix={folderPath}
                  onUploadComplete={onUploadComplete}
                  isDraggingDisabled={isFilteringOrSearching}
                  StorageItem={StorageItem}
                />
              </DroppableColumn>
            ) : (
              <div className={styles.columnLoaderContainer} key={dir.fullPath}>
                <Spinner />
              </div>
            );
          })
        )}
      </FlexElement>
    </div>
  );
}
