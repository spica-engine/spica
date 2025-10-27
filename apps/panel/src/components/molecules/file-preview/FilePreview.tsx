import {memo} from "react";
import {FluidContainer, FlexElement, Icon, Text, Button, type TypeFile} from "oziko-ui-kit";
import styles from "./FilePreview.module.scss";
import {type DirectoryItem} from "../../../types/storage";
import useFileView from "../../../hooks/useFileView";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);

  return `${parseFloat(value.toFixed(2))} ${units[i]}`;
}

interface FilePreviewProps {
  handleClosePreview: () => void;
  previewFile?: DirectoryItem;
}

export const FilePreview = memo(({handleClosePreview, previewFile}: FilePreviewProps) => {
  const isImage = previewFile?.content?.type.startsWith("image/");
  const timestamp = parseInt(previewFile?._id.substring(0, 8) || "0", 16) * 1000;
  const url = new URL(previewFile?.url ?? window.location.origin);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("t", String(Date.now()));
  const urlWithTimestamp = url.toString();
  const file: TypeFile | undefined = {...previewFile, url: urlWithTimestamp} as TypeFile;
  const fileView = useFileView({file});
  const createdAt = new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  return (
    <>
      <FluidContainer
        className={styles.filePreviewContent}
        gap={10}
        direction="vertical"
        dimensionY="fill"
        root={{
          children: (
            <FlexElement gap={10} direction="vertical">
              <FluidContainer
                dimensionX="fill"
                alignment="rightCenter"
                suffix={{
                  children: (
                    <Button
                      className={styles.closePreviewButton}
                      variant="icon"
                      onClick={handleClosePreview}
                    >
                      <Icon name="close" />
                    </Button>
                  )
                }}
              />
              <FlexElement className={styles.fileView}>{fileView}</FlexElement>
            </FlexElement>
          ),
          className: styles.fileViewContainer
        }}
        suffix={{
          className: styles.metadata,
          children: (
            <FlexElement direction="vertical" className={styles.metadataContent}>
              <FlexElement direction="vertical" gap={10}>
                <Text className={styles.metadataName}>{previewFile?.label}</Text>
                <Text>
                  {previewFile?.content?.type} - {formatFileSize(previewFile?.content?.size || 0)}
                </Text>
                <Text>{createdAt}</Text>
              </FlexElement>
              <FlexElement gap={10}>
                <Button className={styles.metadataButton} variant="text">
                  <Icon name="fileMultiple" size={14} />
                  Copy
                </Button>
                {isImage && (
                  <Button className={styles.metadataButton} variant="text">
                    <Icon name="pencil" size={14} />
                    Edit
                  </Button>
                )}
                <Button className={styles.metadataButton} variant="text">
                  <Icon name="swapHorizontal" size={14} />
                  Replace
                </Button>

                <Button
                  className={`${styles.metadataButton} ${styles.metadataClearButton}`}
                  color="danger"
                >
                  <Icon name="delete" size={14} />
                  Delete
                </Button>
              </FlexElement>
            </FlexElement>
          )
        }}
      />
    </>
  );
});
