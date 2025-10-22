import {FlexElement, Spinner, type TypeFile} from "oziko-ui-kit";
import styles from "./StorageColumns.module.scss";
import {useMemo} from "react";
import {ROOT_PATH} from "../../../pages/storage/StorageHooks";
import {DndProvider} from "react-dnd";
import {HTML5Backend} from "react-dnd-html5-backend";
import {useDragAndDrop} from "./StorageColumnHooks";
import {StorageItemColumn} from "./StorageColumn";

export type TypeDirectoryDepth = number;
export type DirectoryItem = TypeFile & {fullPath: string; label?: string; isActive?: boolean, currentDepth?: TypeDirectoryDepth};
export type TypeDirectory = {
  items?: DirectoryItem[];
  label: string;
  fullPath: string;
  currentDepth?: TypeDirectoryDepth;
  isActive: boolean;
  content: {
    type: string;
    size: number;
  };
};
export type TypeDirectories = TypeDirectory[];

function getVisibleDirectories(directories: TypeDirectories): TypeDirectories {
  return directories
    .filter(dir => dir.currentDepth)
    .sort((a, b) => (a.currentDepth || 0) - (b.currentDepth || 0));
}

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
  isDraggingDisabled?: boolean;
}

export function StorageItemColumns({
  handleFolderClick,
  setPreviewFile,
  directory,
  setDirectory,
  previewFile,
  onUploadComplete,
  isDraggingDisabled = false
}: StorageItemColumnsProps) {
  const {handleDrop} = useDragAndDrop(directory, setDirectory);

  const visibleDirectories = useMemo(() => getVisibleDirectories(directory), [directory]);
  const maxDepth = useMemo(() => {
    return Math.max(...visibleDirectories.map(dir => dir.currentDepth || 0), 0);
  }, [visibleDirectories]);
  return (
    <DndProvider backend={HTML5Backend}>
      <div className={styles.container}>
        <FlexElement className={styles.columns} gap={0}>
          {visibleDirectories.map(dir =>
            dir.items ? (
              <StorageItemColumn
                key={dir.fullPath}
                items={dir.items || []}
                handleFolderClick={handleFolderClick}
                setPreviewFile={setPreviewFile}
                depth={dir.currentDepth!}
                directory={directory}
                previewFileId={previewFile?._id}
                prefix={
                  dir.fullPath === ROOT_PATH
                    ? ""
                    : dir.fullPath.split("/").filter(Boolean).join("/") + "/"
                }
                onUploadComplete={onUploadComplete}
                isDraggingDisabled={isDraggingDisabled}
                handleDrop={handleDrop}
                className={maxDepth === dir.currentDepth ? styles.lastColumn : ""}
              />
            ) : (
              <div className={styles.columnLoaderContainer} key={dir.fullPath}>
                <Spinner />
              </div>
            )
          )}
        </FlexElement>
      </div>
    </DndProvider>
  );
}
