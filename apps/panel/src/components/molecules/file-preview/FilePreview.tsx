import {FluidContainer, FlexElement, type TypeFile} from "oziko-ui-kit";
import styles from "./FilePreview.module.scss";
import {useUpdateStorageItemMutation} from "../../../store/api";
import {type DirectoryItem} from "../../../types/storage";
import useFileView from "../../../hooks/useFileView";
import {FileMetadata} from "./file-metadata/FileMetadata";
import {FileActions} from "./file-actions/FileActions";
import {FileViewerFrame} from "./file-viewer-frame/FileViewerFrame";

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

function getCopyUrl(file?: TypeFile): string {
  if (!file) return "";

  const serverUrl = import.meta.env.VITE_BASE_URL as string;
  const isLocal = isLocalServerUrl(serverUrl);
  const origin = window.location.origin;

  if (isLocal) {
    return `${origin}/storage-view/${file._id}`;
  }

  const url = new URL(file.url);

  if (url.hostname === "storage.googleapis.com") {
    const formattedUrl = formatUrlForGoogleStorage(file.url);
    if (formattedUrl) {
      return formattedUrl;
    }
  }

  return `${origin}/storage-view/${file._id}`;
}

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
  const createdAt = new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  const handleCopy = () => {
    const copyUrl = getCopyUrl(previewFile);
    if (copyUrl) {
      navigator.clipboard.writeText(copyUrl);
    }
  };

  const handleReplace = (rawFile: File) => {
    if (!previewFile?._id) return;

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
        onFileReplaced?.(directoryItem);
      })
      .catch(error => {
        console.error("File replacement failed:", error);
        onFileReplaced?.(previewFile);
      });
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
              <FileMetadata
                name={previewFile?.label}
                type={previewFile?.content?.type}
                size={previewFile?.content?.size}
                createdAt={createdAt}
              />
              <FileActions
                onCopy={handleCopy}
                onReplace={handleReplace}
                onDelete={onFileDeleted}
                fileId={previewFile?._id}
                isImage={isImage}
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
