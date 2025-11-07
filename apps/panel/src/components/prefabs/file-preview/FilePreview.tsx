import {FluidContainer, FlexElement, type TypeFile} from "oziko-ui-kit";
import styles from "./FilePreview.module.scss";
import {useUpdateStorageItemMutation} from "../../../store/api";
import {type DirectoryItem} from "../../../types/storage";
import useFileView from "../../../hooks/useFileView";
import {FileMetadata} from "./file-metadata/FileMetadata";
import {FileActions} from "./file-actions/FileActions";
import {FileViewerFrame} from "./file-viewer-frame/FileViewerFrame";
import {useLayoutEffect, useMemo, useState} from "react";
import {getTimestampFromObjectId, buildFileUrl} from "./utils";

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
    () => getTimestampFromObjectId(previewFile?._id),
    [previewFile?._id]
  );

  useLayoutEffect(() => {
    const url = buildFileUrl(previewFile?.url, {timestamp});
    setFileUrl(url);
  }, [previewFile?.url, previewFile?._id, previewFile?.content.type, timestamp]);

  const file = useMemo(
    () => ({...previewFile, url: fileUrl || previewFile?.url}),
    [previewFile?._id, previewFile?.url, fileUrl]
  ) as DirectoryItem;

  const fileView = useFileView({file, isLoading, classNames: {doc: styles.wordDocViewer}});

  const handleReplaceFile = (updatedFile: DirectoryItem) => {
    if (!onFileReplaced) return;
    onFileReplaced(updatedFile);
    const newUrl = buildFileUrl(updatedFile.url, {cacheBust: true});
    setFileUrl(newUrl);
  };

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
              <FileMetadata file={file!} timestamp={timestamp} />
              <FileActions
                file={file!}
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
