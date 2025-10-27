import {FluidContainer} from "oziko-ui-kit";
import styles from "./Storage.module.scss";
import StorageActionBar from "./components/storage-action-bar/StorageActionBar";
import {FilePreview} from "../../components/molecules/file-preview/FilePreview";
import {useDirectoryNavigation} from "./hooks/useDirectoryNavigation";
import {useFileOperations} from "./hooks/useFileOperations";
import {useFilePreview} from "./hooks/useFilePreview";
import {useStorageDataSync} from "./hooks/useStorageDataSync";
import { useFilteredDirectory } from "./hooks/useFilteredDirectory";
import { useSearchAndFilter } from "./hooks/useSearchAndFilter";
import { StorageItemColumns } from "./components/storage-columns/StorageColumns";
import type { TypeDirectories, TypeDirectoryDepth } from "src/types/storage";

export default function StoragePage() {
  const {directory, setDirectory, handleFolderClick: onFolderClick} = useDirectoryNavigation();
    const {
    searchQuery,
    setSearchQuery,
    filterValue,
    apiFilter,
    isFilteringOrSearching,
    handleApplyFilter
  } = useSearchAndFilter();

  const {previewFile, setPreviewFile, handleClosePreview} = useFilePreview();
  const {displayedDirectory} = useFilteredDirectory(directory, isFilteringOrSearching);
  const {isLoading} = useStorageDataSync(apiFilter, directory, setDirectory, searchQuery, isFilteringOrSearching);

  const {onUploadComplete, onFileReplaced, onFileDeleted} = useFileOperations(
    directory,
    setDirectory,
    setPreviewFile
  );

  const handleFolderClick = (
    folderName: string,
    fullPath: string,
    directoryDepth: TypeDirectoryDepth,
    wasActive: boolean
  ) => {
    handleClosePreview();
    onFolderClick(folderName, fullPath, directoryDepth, wasActive, isFilteringOrSearching);
  };

  return (
    <div className={styles.container}>
      <StorageActionBar
        onSearchChange={setSearchQuery}
        onApplyFilter={handleApplyFilter}
        directory={directory as TypeDirectories}
        currentFilter={filterValue || undefined}
        isLoading={isFilteringOrSearching && isLoading}
      />
      <FluidContainer
        gap={0}
        className={styles.storageItemContainer}
        root={{
          className: styles.storageItemColumns,
          children: (
            <StorageItemColumns
              handleFolderClick={handleFolderClick}
              setPreviewFile={setPreviewFile}
              directory={displayedDirectory}
              setDirectory={setDirectory}
              previewFile={previewFile}
              onUploadComplete={onUploadComplete}
              isDraggingDisabled={!!isFilteringOrSearching}
            />
          )
        }}
        suffix={
          previewFile && {
            className: styles.preview,
            children: (
              <FilePreview
                handleClosePreview={handleClosePreview}
                previewFile={previewFile}
                onFileReplaced={onFileReplaced}
                onFileDeleted={onFileDeleted}
              />
            )
          }
        }
      />
    </div>
  );
}
