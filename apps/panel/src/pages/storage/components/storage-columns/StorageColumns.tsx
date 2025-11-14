
import {useRef, useEffect, useMemo, useState} from "react";
import {FlexElement, Spinner} from "oziko-ui-kit";
import {useAppSelector, useAppDispatch} from "../../../../store/hook";
import {
  selectDirectory,
  setDirectory,
  handleFolderClick as handleFolderClickAction,
  selectSearchQuery,
  selectSearchResults,
  selectStorageFilterQuery
} from "../../../../store";
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

const MIN_SEARCH_LENGTH = 3;

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
  const searchResults = useAppSelector(selectSearchResults);
  const activeFilterQuery = useAppSelector(selectStorageFilterQuery);
  const [isSearchViewActive, setIsSearchViewActive] = useState(false);
  const [selectedSearchPath, setSelectedSearchPath] = useState<string | null>(null);
  const lastActivatedQueryRef = useRef("");

  const handleSetDirectory = (dirs: TypeDirectories) => {
    dispatch(setDirectory(dirs));
  };

  useStorageDataSync(directory, handleSetDirectory, activeFilterQuery);
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
    setSelectedSearchPath(fullPath);
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

  const isSearching = isSearchViewActive;

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    const meetsThreshold = trimmedQuery.length >= MIN_SEARCH_LENGTH;

    if (!meetsThreshold) {
      setIsSearchViewActive(false);
      lastActivatedQueryRef.current = "";
      setSelectedSearchPath(null);
      return;
    }

    if (searchResults.length > 0 && searchQuery !== lastActivatedQueryRef.current) {
      setIsSearchViewActive(true);
      lastActivatedQueryRef.current = searchQuery;
    }
  }, [searchQuery, searchResults]);

  useEffect(() => {
    if (!isSearchViewActive) {
      setSelectedSearchPath(null);
    }
  }, [isSearchViewActive]);

  useEffect(() => {
    setSelectedSearchPath(null);
  }, [searchQuery]);

  const selectedDirectory = useMemo(
    () => (selectedSearchPath ? directory.find(dir => dir.fullPath === selectedSearchPath) : undefined),
    [directory, selectedSearchPath]
  );

  const selectedDirectoryItems = useMemo(() => {
    if (!selectedDirectory?.items) return undefined;
    return [...selectedDirectory.items].sort((a, b) => {
      const aIsDir = a.content?.type === "inode/directory";
      const bIsDir = b.content?.type === "inode/directory";
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      const firstName = a.label || a.name;
      const secondName = b.label || b.name;
      return firstName.localeCompare(secondName);
    });
  }, [selectedDirectory?.items]);

  const selectedFolderPrefix = useMemo(() => {
    if (!selectedDirectory) return "";
    return selectedDirectory.fullPath === ROOT_PATH
      ? ""
      : selectedDirectory.fullPath.split("/").filter(Boolean).join("/") + "/";
  }, [selectedDirectory]);

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
          {/* {selectedSearchPath && (
            <div className={`${styles.storageItemColumnContainer} ${styles.lastColumn}`}>
              {selectedDirectoryItems ? (
                <StorageItemColumn
                  items={selectedDirectoryItems}
                  handleFolderClick={handleSearchFolderClick}
                  setPreviewFile={setPreviewFile}
                  depth={(selectedDirectory?.currentDepth || 0) + 1}
                  directory={directory}
                  previewFileId={previewFile?._id}
                  prefix={selectedFolderPrefix}
                  onUploadComplete={onUploadComplete}
                  isDraggingDisabled
                  StorageItem={StorageItem}
                />
              ) : (
                <div className={styles.columnLoaderContainer}>
                  <Spinner />
                </div>
              )}
            </div>
          )} */}
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
