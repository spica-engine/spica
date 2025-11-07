import {FluidContainer} from "oziko-ui-kit";
import styles from "./Storage.module.scss";
import {StorageItemColumns} from "./components/storage-columns/StorageColumns";
import StorageActionBar from "./components/storage-action-bar/StorageActionBar";
import { FilePreview } from "../../components/prefabs/file-preview/FilePreview";
import { useFilePreview } from "./hooks/useFilePreview";

export default function StoragePage() {
  const {previewFile, setPreviewFile, handleClosePreview} = useFilePreview();
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
                // onFileDeleted={onFileDeleted}
                // onFileReplaced={onFileReplaced}
              />
            )
          }
        }
      />
    </div>
  );
}
