import {FluidContainer, FlexElement, type TypeFile} from "oziko-ui-kit";
import styles from "./FilePreview.module.scss";
import {useUpdateStorageItemMutation} from "../../../store/api";
import {type DirectoryItem} from "../../../types/storage";
import useFileView from "../../../hooks/useFileView";
import {FileMetadata} from "./file-metadata/FileMetadata";
import {FileActions} from "./file-actions/FileActions";
import {FileViewerFrame} from "./file-viewer-frame/FileViewerFrame";
import {useMemo} from "react";

interface FilePreviewProps {
  handleClosePreview: () => void;
  previewFile?: DirectoryItem;
  onFileReplaced?: (updatedFile: DirectoryItem) => void;
  onFileDeleted?: (fileId: string) => void;
}

export const FilePreview = ({
  handleClosePreview,
  previewFile,
  onFileReplaced,
  onFileDeleted
}: FilePreviewProps) => {
  const [updateStorageItem, {isLoading}] = useUpdateStorageItemMutation();
  const timestamp = useMemo(
    () => parseInt(previewFile?._id.substring(0, 8) || "0", 16) * 1000,
    [previewFile]
  );
  const url = useMemo(() => {
    const url = new URL(previewFile?.url ?? window.location.origin);
    url.searchParams.set("timestamp", String(timestamp));
    const urlWithTimestamp = url?.toString();
    return urlWithTimestamp;
  }, [previewFile]);

  const fileView = useFileView({
    file: {...previewFile, url} as TypeFile,
    isLoading
  });

  return (
    <>
      <FluidContainer
        className={styles.filePreviewContent}
        gap={10}
        direction="vertical"
        dimensionY="fill"
        root={{
          children: <FileViewerFrame onClose={handleClosePreview}>{fileView}</FileViewerFrame>,
          className: styles.fileViewContainer
        }}
        suffix={{
          className: styles.metadata,
          children: (
            <FlexElement direction="vertical" className={styles.metadataContent}>
              <FileMetadata file={previewFile!} timestamp={timestamp} />
              <FileActions
                file={previewFile!}
                onFileReplaced={onFileReplaced}
                updateStorageItem={updateStorageItem}
                onDelete={onFileDeleted}
                isLoading={isLoading}
                onClose={handleClosePreview}
              />
            </FlexElement>
          )
        }}
      />
    </>
  );
};
