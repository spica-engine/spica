import {FluidContainer} from "oziko-ui-kit";
import styles from "./Storage.module.scss";
import StorageActionBar from "./components/storage-action-bar/StorageActionBar";
import {useDirectoryNavigation} from "./hooks/useDirectoryNavigation";
import {useFileOperations} from "./hooks/useFileOperations";
import {useFilePreview} from "./hooks/useFilePreview";
import {useStorageDataSync} from "./hooks/useStorageDataSync";
import {useSearchAndFilter} from "./hooks/useSearchAndFilter";
import {StorageItemColumns} from "./components/storage-columns/StorageColumns";
import type {TypeDirectories, TypeDirectoryDepth} from "src/types/storage";

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
  const {isLoading} = useStorageDataSync(
    apiFilter,
    directory,
    setDirectory,
    searchQuery,
    isFilteringOrSearching
  );

  const {onUploadComplete} = useFileOperations(
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
              directory={directory}
              setDirectory={setDirectory}
              previewFile={previewFile}
              onUploadComplete={onUploadComplete}
              isFilteringOrSearching={isFilteringOrSearching}
              isLoading={isLoading}
            />
          )
        }}
      />
    </div>
  );
}
