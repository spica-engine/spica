import {FluidContainer} from "oziko-ui-kit";
import styles from "./Storage.module.scss";
import {StorageItemColumns} from "../../components/organisms/storage-columns/StorageColumns";
import {FilePreview} from "../../components/molecules/file-preview/FilePreview";
import StorageActionBar from "../../components/molecules/storage-action-bar/StorageActionBar";
import {
  useDirectoryNavigation,
  useFilePreview,
  useFileOperations,
  useStorageDataSync
} from "./StorageHooks";

export default function StoragePage() {
  const {directory, setDirectory, handleFolderClick: onFolderClick} = useDirectoryNavigation();

  const {previewFile, setPreviewFile, handleClosePreview} = useFilePreview();
  useStorageDataSync(directory, setDirectory);
  const {onUploadComplete} = useFileOperations(directory, setDirectory, setPreviewFile);

  const handleFolderClick = (
    folderName: string,
    fullPath: string,
    directoryDepth: any,
    wasActive: boolean
  ) => {
    handleClosePreview();
    onFolderClick(folderName, fullPath, directoryDepth, wasActive);
  };

  return (
    <div className={styles.container}>
      <StorageActionBar directory={directory} />
      <FluidContainer
        className={styles.storageItemContainer}
        root={{
          className: styles.storageItemColumns,
          children: (
            <StorageItemColumns
              handleFolderClick={handleFolderClick}
              setPreviewFile={setPreviewFile}
              directory={directory}
              previewFile={previewFile}
              onUploadComplete={onUploadComplete}
            />
          )
        }}
        suffix={
          previewFile && {
            className: styles.preview,
            children: (
              <FilePreview handleClosePreview={handleClosePreview} previewFile={previewFile} />
            )
          }
        }
      />
    </div>
  );
}
