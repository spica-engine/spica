import {FluidContainer, type TypeFile} from "oziko-ui-kit";
import styles from "./Storage.module.scss";
import {StorageItemColumns} from "./components/storage-columns/StorageColumns";
import {FilePreview} from "../../components/molecules/file-preview/FilePreview";
import StorageActionBar from "./components/storage-action-bar/StorageActionBar";
import {useDirectoryNavigation} from "./hooks/useDirectoryNavigation";
import {useFileOperations} from "./hooks/useFileOperations";
import {useFilePreview} from "./hooks/useFilePreview";
import {useStorageDataSync} from "./hooks/useStorageDataSync";
import type {TypeDirectoryDepth} from "src/types/storage";

export default function StoragePage() {
  const {directory, setDirectory, handleFolderClick: onFolderClick} = useDirectoryNavigation();
  const {previewFile, setPreviewFile, handleClosePreview} = useFilePreview();
  useStorageDataSync(directory, setDirectory);
  const {onUploadComplete, onFileReplaced, onFileDeleted} = useFileOperations(directory, setDirectory, setPreviewFile);

  const handleFolderClick = (
    folderName: string,
    fullPath: string,
    directoryDepth: TypeDirectoryDepth,
    wasActive: boolean,
  ) => {
    handleClosePreview();
    onFolderClick(folderName, fullPath, directoryDepth, wasActive, false);
  };

  return (
    <div className={styles.container}>
      <StorageActionBar />
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
