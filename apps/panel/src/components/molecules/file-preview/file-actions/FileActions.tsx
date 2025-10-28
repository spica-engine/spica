import {useCallback, useMemo, useRef} from "react";
import {FlexElement, Button, Icon, type TypeFile} from "oziko-ui-kit";
import {DeleteFileButton} from "./DeleteFileButton";
import styles from "./FileActions.module.scss";
import type {DirectoryItem} from "src/types/storage";
import {getParentPath} from "../../../../pages/storage/utils";
import {ROOT_PATH} from "../../../../pages/storage/constants";
import {useUpdateStorageItemMutation} from "../../../../store/api";

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

interface FileActionsProps {
  file: DirectoryItem;
  onEdit?: () => void;
  onDelete?: (fileId: string) => void;
  isLoading?: boolean;
  onClose?: () => void;
  onFileReplaced?: (updatedFile: DirectoryItem) => void;
  updateStorageItem: ReturnType<typeof useUpdateStorageItemMutation>[0];
}

export const FileActions = ({
  file,
  onEdit,
  onFileReplaced,
  onDelete,
  isLoading,
  onClose,
  updateStorageItem
}: FileActionsProps) => {
  const isImage = file?.content?.type.startsWith("image/");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCopy = useCallback((file: TypeFile) => {
    const copyUrl = getCopyUrl(file);
    if (copyUrl) {
      navigator.clipboard.writeText(copyUrl);
    }
  }, []);

  const handleReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const rawFile = files[0];
    if (!file?._id) return;

    const parentPath = getParentPath(file.fullPath);
    const fileName = `${parentPath === ROOT_PATH ? "" : parentPath}${rawFile.name}`;
    const encodedFileName = encodeURIComponent(fileName);
    const fileToUpload = new File([rawFile], encodedFileName, {type: rawFile.type});

    const temporaryFile = {
      ...file,
      name: fileName,
      label: rawFile.name,
      content: {
        type: rawFile.type,
        size: rawFile.size
      }
    };

    onFileReplaced?.(temporaryFile);

    updateStorageItem({id: file._id, file: fileToUpload})
      .unwrap()
      .then(updatedFile => {
        if (!updatedFile) {
          onFileReplaced?.(file);
          return;
        }

        const directoryItem = {
          ...updatedFile,
          label: rawFile.name,
          fullPath: fileName,
          currentDepth: file.currentDepth
        } as DirectoryItem;
        onFileReplaced?.(directoryItem);
      })
      .catch(error => {
        console.error("File replacement failed:", error);
        onFileReplaced?.(file);
      });

    e.target.value = "";
  };

  return (
    <FlexElement gap={10}>
      <Button className={styles.actionButton} variant="text" onClick={() => handleCopy(file)}>
        <Icon name="fileMultiple" size={14} />
        Copy
      </Button>
      {isImage && (
        <Button className={styles.actionButton} variant="text" onClick={onEdit}>
          <Icon name="pencil" size={14} />
          Edit
        </Button>
      )}
      <Button
        className={styles.actionButton}
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
      <DeleteFileButton fileId={file._id} onFileDeleted={onDelete} onClose={onClose} />
    </FlexElement>
  );
};
