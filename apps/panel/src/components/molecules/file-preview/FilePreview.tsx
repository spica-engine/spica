import {memo, useRef, useState} from "react";
import {FluidContainer, FlexElement, Icon, Text, Button, type TypeFile} from "oziko-ui-kit";
import styles from "./FilePreview.module.scss";
import {type DirectoryItem} from "../../organisms/storage-columns/StorageColumns";
import {useUpdateStorageItemMutation} from "../../../store/api";
import useFileView from "../../../hooks/useFileView";
import {DeleteFileButton} from "./DeleteFileButton";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);

  return `${parseFloat(value.toFixed(2))} ${units[i]}`;
}

const ROOT_PATH = "/";
const getParentPath = (fullPath?: string) => {
  const res =
    fullPath?.replace(/\/[^/]+\/?$/, "") === fullPath
      ? "/"
      : fullPath?.replace(/\/[^/]+\/?$/, "") || "/";
  return res === "/" ? res : res + "/";
};

function isLocalServerUrl(urlStr?: string) {
  if (!urlStr) return false;
  try {
    const {hostname} = new URL(urlStr);
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local")
    ) {
      return true;
    }
    // private LAN ranges (treat as local/dev)
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function formatUrlForGoogleStorage(url: string) {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/b\/([^/]+)\/o\/([^/]+)/);
  if (!match) return null;
  const [, projectName, objectId] = match;
  return `${parsed.protocol}//${parsed.host}/${projectName}/${objectId}`;
}

const handleCopy = (previewFile?: TypeFile) => {
  if (!previewFile) return;

  const serverUrl = import.meta.env.VITE_BASE_URL as string;
  const isLocal = isLocalServerUrl(serverUrl);
  const origin = window.location.origin;

  if (isLocal) {
    navigator.clipboard.writeText(`${origin}/storage-view/${previewFile._id}`);
    return;
  }

  const url = new URL(previewFile.url);

  if (url.hostname === "storage.googleapis.com") {
    const formattedUrl = formatUrlForGoogleStorage(previewFile.url);

    if (formattedUrl) {
      navigator.clipboard.writeText(formattedUrl);
      return;
    }
  }

  navigator.clipboard.writeText(`${origin}/storage-view/${previewFile._id}`);
};

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
  const isImage = previewFile?.content?.type.startsWith("image/");
  const timestamp = parseInt(previewFile?._id.substring(0, 8) || "0", 16) * 1000;
  const url = new URL(previewFile?.url ?? window.location.origin);
  url.searchParams.set("timestamp", String(timestamp));
  const urlWithTimestamp = url.toString();
  const fileView = useFileView({
    file: {...previewFile, url: urlWithTimestamp} as TypeFile,
    isLoading
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createdAt = new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  const handleReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !previewFile?._id) return;

    const rawFile = files[0];
    const parentPath = getParentPath(previewFile.fullPath);
    const fileName = `${parentPath === ROOT_PATH ? "" : parentPath}${rawFile.name}`;
    const encodedFileName = encodeURIComponent(fileName);
    const fileToUpload = new File([rawFile], encodedFileName, {type: rawFile.type});

    const temporaryFile = {
      ...previewFile,
      name: fileName,
      label: rawFile.name,
      content: {
        type: rawFile.type,
        size: rawFile.size
      }
    };

    onFileReplaced?.(temporaryFile);

    updateStorageItem({id: previewFile._id, file: fileToUpload})
      .unwrap()
      .then(updatedFile => {
        if (!updatedFile) {
          onFileReplaced?.(previewFile);
          return;
        }

        const directoryItem = {
          ...updatedFile,
          label: rawFile.name,
          fullPath: fileName
        } as DirectoryItem;
        console.log("File replaced successfully:", directoryItem, "updatedFile:", updatedFile);
        onFileReplaced?.(directoryItem);
      })
      .catch(error => {
        console.error("File replacement failed:", error);
        onFileReplaced?.(previewFile);
      });

    e.target.value = "";
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
                <Button
                  className={styles.metadataButton}
                  variant="text"
                  onClick={() => handleCopy(previewFile)}
                >
                  <Icon name="fileMultiple" size={14} />
                  Copy
                </Button>
                {isImage && (
                  <Button className={styles.metadataButton} variant="text">
                    <Icon name="pencil" size={14} />
                    Edit
                  </Button>
                )}
                <Button
                  className={styles.metadataButton}
                  variant="text"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Icon name="swapHorizontal" size={14} />
                  Replace
                </Button>
                <input
                  id="replace-file-input"
                  type="file"
                  style={{display: "none"}}
                  onChange={handleReplace}
                  ref={fileInputRef}
                />
                {previewFile?._id && onFileDeleted && (
                  <DeleteFileButton
                    fileId={previewFile._id}
                    onFileDeleted={onFileDeleted}
                    onClose={handleClosePreview}
                  />
                )}
              </FlexElement>
            </FlexElement>
          )
        }}
      />
    </>
  );
};
