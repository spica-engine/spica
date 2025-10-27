import {FluidContainer, FlexElement, type TypeFile} from "oziko-ui-kit";
import styles from "./FilePreview.module.scss";
import {useUpdateStorageItemMutation} from "../../../store/api";
import {type DirectoryItem} from "../../../types/storage";
import useFileView from "../../../hooks/useFileView";
import {FileMetadata} from "./file-metadata/FileMetadata";
import {FileActions} from "./file-actions/FileActions";
import {FileViewerFrame} from "./file-viewer-frame/FileViewerFrame";
import {useEffect, useLayoutEffect, useMemo, useState} from "react";
import {set} from "lodash";

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
  const [fileUrl, setFileUrl] = useState<string | null>(previewFile?.url || null);

  const timestamp = useMemo(
    () => parseInt(previewFile?._id.substring(0, 8) || "0", 16) * 1000,
    [previewFile?._id]
  );

  useLayoutEffect(() => {
    const url = new URL(previewFile?.url!);
    url.searchParams.set("timestamp", String(timestamp));
    const urlWithTimestamp = url?.toString();
    console.log("FilePreview setting fileUrl:", urlWithTimestamp);
    setFileUrl(urlWithTimestamp);
  }, [previewFile?.url, previewFile?._id, previewFile?.content.type]);

  const fileView = useFileView({
    file: {...previewFile, url: fileUrl || previewFile?.url} as TypeFile,
    isLoading
  });

  const memoizedFileView = useMemo(
    () => fileView,
    [previewFile?._id, previewFile?.url, previewFile?.content.type, isLoading]
  );

  const handleReplaceFile = (updatedFile: DirectoryItem) => {
    if (!onFileReplaced) return;
    onFileReplaced(updatedFile);
    const newUrl = new URL(updatedFile.url);
    newUrl.searchParams.set("t", String(Date.now()));
    setFileUrl(newUrl.toString());
  };

  return (
    <>
      <FluidContainer
        className={styles.filePreviewContent}
        gap={10}
        direction="vertical"
        dimensionY="fill"
        root={{
          children: (
            <FileViewerFrame onClose={handleClosePreview}>{memoizedFileView}</FileViewerFrame>
          ),
          className: styles.fileViewContainer
        }}
        suffix={{
          className: styles.metadata,
          children: (
            <FlexElement direction="vertical" className={styles.metadataContent}>
              <FileMetadata file={previewFile!} timestamp={timestamp} />
              <FileActions
                file={previewFile!}
                onFileReplaced={handleReplaceFile}
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
