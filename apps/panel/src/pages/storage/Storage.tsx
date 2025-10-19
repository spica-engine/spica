import {FluidContainer} from "oziko-ui-kit";
import styles from "./Storage.module.scss";
import {StorageItemColumns} from "../../components/organisms/storage-columns/StorageColumns";
import {FilePreview} from "../../components/molecules/file-preview/FilePreview";
import StorageActionBar from "../../components/molecules/storage-action-bar/StorageActionBar";
import {
  useDirectoryNavigation,
  useSearchAndFilter,
  useFilePreview,
  useFilteredDirectory,
  useStorageDataSync,
  useFileOperations
} from "./StorageHooks";

export default function StoragePage() {
  const {directory, setDirectory, handleFolderClick: onFolderClick} = useDirectoryNavigation();

  const {
    searchQuery,
    setSearchQuery,
    filterValue,
    apiFilter,
    isFilteringOrSearching,
    handleApplyFilter,
    filterItemsBySearch,
    filterItemsByFilter
  } = useSearchAndFilter();

  const {previewFile, setPreviewFile, handleClosePreview} = useFilePreview();

  const {displayedDirectory} = useFilteredDirectory(
    directory,
    searchQuery,
    filterValue,
    filterItemsBySearch,
    filterItemsByFilter,
    isFilteringOrSearching
  );

  useStorageDataSync(apiFilter, directory, setDirectory);

  const {onUploadComplete, onFileReplaced, onFileDeleted} = useFileOperations(
    directory,
    setDirectory,
    setPreviewFile,
  );

  const handleFolderClick = (
    folderName: string,
    fullPath: string,
    directoryDepth: any,
    wasActive: boolean
  ) => {
    handleClosePreview();
    onFolderClick(folderName, fullPath, directoryDepth, wasActive, isFilteringOrSearching);
  };

  return (
    <div className={styles.container}>
      <StorageActionBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onApplyFilter={handleApplyFilter}
      />
      <FluidContainer
        className={styles.storageItemContainer}
        root={{
          className: styles.storageItemColumns,
          children: (
            <StorageItemColumns
              handleFolderClick={handleFolderClick}
              setPreviewFile={setPreviewFile}
              directory={displayedDirectory}
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
