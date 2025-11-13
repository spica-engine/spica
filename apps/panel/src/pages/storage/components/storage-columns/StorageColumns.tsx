
import {useRef, useEffect, useMemo} from "react";
import {FlexElement, Spinner} from "oziko-ui-kit";
import {useAppSelector, useAppDispatch} from "../../../../store/hook";
import {selectDirectory, setDirectory, handleFolderClick as handleFolderClickAction, selectSearchQuery, setSearchQuery} from "../../../../store";
import {useDragAndDrop} from "../../hooks/useDragAndDrop";
import {useStorageDataSync} from "../../hooks/useStorageDataSync";
import {useFileOperations} from "../../hooks/useFileOperations";
import {ROOT_PATH} from "../../constants";
import type {
  DirectoryItem,
  TypeDirectories,
} from "../../../../types/storage";
import styles from "./StorageColumns.module.scss";
import { DroppableColumn } from "../droppable-column/DroppableColumn";
import { StorageItem } from "../storage-item/StorageItem";
import { StorageItemColumn } from "../storage-column/StorageColumn";

interface StorageColumnsProps {
  readonly setPreviewFile: (file?: DirectoryItem) => void;
  readonly handleClosePreview: () => void;
  readonly previewFile?: DirectoryItem;
}


export function StorageItemColumns({
  setPreviewFile,
  handleClosePreview,
  previewFile
}: StorageColumnsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();
  const directory = useAppSelector(selectDirectory);
  const searchQuery = useAppSelector(selectSearchQuery);

  const handleSetDirectory = (dirs: TypeDirectories) => {
    dispatch(setDirectory(dirs));
  };

  useStorageDataSync(directory, handleSetDirectory);
  const {onUploadComplete} = useFileOperations(directory, handleSetDirectory, setPreviewFile);
  const {handleDrop} = useDragAndDrop(directory, handleSetDirectory);

  const handleFolderClick = (
    folderName: string,
    fullPath: string,
    directoryDepth: number,
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

  const handleSearchFolderClick = (
    folderName: string,
    fullPath: string,
    directoryDepth: number,
    wasActive: boolean
  ) => {
    handleClosePreview();
    dispatch(setSearchQuery(""));
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

  const isSearching = searchQuery.trim().length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];

    const query = searchQuery.trim().toLowerCase();
    const allItems = directory.flatMap(dir => dir.items ?? []);

    const uniqueItems = new Map<string, DirectoryItem>();

    allItems.forEach(item => {
      if (!item) return;

      const searchableName = (item.label || item.name || "").toLowerCase();
      if (!searchableName) return;

      if (searchableName.includes(query)) {
        const uniqueKey = item._id || item.fullPath || searchableName;
        if (!uniqueItems.has(uniqueKey)) {
          uniqueItems.set(uniqueKey, item);
        }
      }
    });

    return Array.from(uniqueItems.values()).sort((a, b) => {
      const firstName = (a.label || a.name || "").toLowerCase();
      const secondName = (b.label || b.name || "").toLowerCase();
      return firstName.localeCompare(secondName);
    });
  }, [directory, searchQuery, isSearching]);

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

  if (isSearching) {
    return (
      <div ref={containerRef} className={styles.container}>
        <FlexElement className={styles.columns} gap={0}>
          <div className={`${styles.storageItemColumnContainer} ${styles.lastColumn}`}>
            <StorageItemColumn
              items={searchResults}
              handleFolderClick={handleSearchFolderClick}
              setPreviewFile={setPreviewFile}
              depth={1}
              directory={directory}
              previewFileId={previewFile?._id}
              prefix=""
              onUploadComplete={onUploadComplete}
              isDraggingDisabled
              StorageItem={StorageItem}
            />
          </div>
        </FlexElement>
      </div>
    );
  }

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
              <StorageItemColumn
                items={orderedItems}
                handleFolderClick={handleFolderClick}
                setPreviewFile={setPreviewFile}
                depth={dir.currentDepth || 0}
                directory={directory}
                previewFileId={previewFile?._id}
                prefix={folderPath}
                onUploadComplete={onUploadComplete}
                isDraggingDisabled={false}
                StorageItem={StorageItem}
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
