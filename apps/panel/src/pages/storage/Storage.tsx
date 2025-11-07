import {FluidContainer} from "oziko-ui-kit";
import styles from "./Storage.module.scss";
import {StorageItemColumns} from "./components/storage-columns/StorageColumns";
import StorageActionBar from "./components/storage-action-bar/StorageActionBar";
import { FilePreview } from "../../components/prefabs/file-preview/FilePreview";
import { useFilePreview } from "./hooks/useFilePreview";
import { useFileOperations } from "./hooks/useFileOperations";
import { useDirectoryNavigation } from "./hooks/useDirectoryNavigation";

export default function StoragePage() {
  // here is need to be fixed
  const {directory, setDirectory, handleFolderClick: onFolderClick} = useDirectoryNavigation();
  const {previewFile, setPreviewFile, handleClosePreview} = useFilePreview();
  const {onUploadComplete, onFileReplaced, onFileDeleted} = useFileOperations(
    directory,
    setDirectory,
    setPreviewFile
  );
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
              setPreviewFile={setPreviewFile}
              handleClosePreview={handleClosePreview}
              previewFile={previewFile}
            />
          )
        }}
        suffix={
          previewFile && {
            className: styles.preview,
            children: (
              <FilePreview
                key={previewFile?._id}
                handleClosePreview={handleClosePreview}
                previewFile={previewFile}
                onFileDeleted={onFileDeleted}
                onFileReplaced={onFileReplaced}
              />
            )
          }
        }
      />
    </div>
  );
}