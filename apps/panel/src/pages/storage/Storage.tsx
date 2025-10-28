import {FluidContainer} from "oziko-ui-kit";
import styles from "./Storage.module.scss";
import {StorageItemColumns} from "./components/storage-columns/StorageColumns";
import StorageActionBar from "./components/storage-action-bar/StorageActionBar";
import {useDirectoryNavigation} from "./hooks/useDirectoryNavigation";
import {useFileOperations} from "./hooks/useFileOperations";
import {useFilePreview} from "./hooks/useFilePreview";
import {useStorageDataSync} from "./hooks/useStorageDataSync";
import type {DirectoryItem, TypeDirectoryDepth} from "src/types/storage";
import { FilePreview } from "../../components/molecules/file-preview/FilePreview";

export default function StoragePage() {
  const {directory, setDirectory, handleFolderClick: onFolderClick} = useDirectoryNavigation();
  const {previewFile, setPreviewFile, handleClosePreview} = useFilePreview();
  useStorageDataSync(directory, setDirectory);
  const {onUploadComplete} = useFileOperations(directory, setDirectory, setPreviewFile);

  const handleFolderClick = (
    folderName: string,
    fullPath: string,
    directoryDepth: TypeDirectoryDepth,
    wasActive: boolean,
  ) => {
    handleClosePreview();
    onFolderClick(folderName, fullPath, directoryDepth, wasActive, false);
  };

  const handleCloseFolder = (depthToClose: TypeDirectoryDepth) => {
    const folder = directory.find(dir => dir.currentDepth === depthToClose) as DirectoryItem;
    if (!folder) return;
    onFolderClick(folder.name, folder.fullPath, depthToClose, true, false);
  };

  const handleFileClick = (file?: DirectoryItem) => {
    if (!file) {
      setPreviewFile(undefined);
      return;
    }

    handleCloseFolder(file.currentDepth as TypeDirectoryDepth);
    setPreviewFile(undefined);
    setPreviewFile(file);
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
              setPreviewFile={handleFileClick}
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
                key={previewFile?._id}
                handleClosePreview={handleClosePreview}
                previewFile={previewFile}
              />
            )
          }
        }
      />
    </div>
  );
}
