import {useMemo} from "react";
import {FlexElement, Button, Icon} from "oziko-ui-kit";
import type {DirectoryItem} from "src/types/storage";
import {DeleteFileButton} from "./DeleteFileButton";
import {useFileActions} from "../hooks/useFileActions";
import styles from "./FileActions.module.scss";

interface FileActionsProps {
  file: DirectoryItem;
  onEdit?: () => void;
  onDelete?: (fileId: string) => void;
  isLoading?: boolean;
  onClose?: () => void;
  onFileReplaced?: (updatedFile: DirectoryItem) => void;
  updateStorageItem: (params: {id: string; file: File}) => {
    unwrap: () => Promise<any>;
  };
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

  const config = useMemo(
    () => ({
      serverUrl: import.meta.env.VITE_BASE_URL ?? "",
      origin: window.location.origin
    }),
    []
  );

  const {fileInputRef, handleCopyUrl, handleReplaceFile} = useFileActions(config, {
    onFileReplaced,
    updateStorageItem
  });

  return (
    <FlexElement gap={10}>
      <Button 
        className={styles.actionButton} 
        variant="text" 
        onClick={() => handleCopyUrl(file)}
        aria-label="Copy file URL"
      >
        <Icon name="fileMultiple" size={14} />
        Copy
      </Button>

      {isImage && (
        <Button 
          className={styles.actionButton} 
          variant="text" 
          onClick={onEdit}
          aria-label="Edit image"
        >
          <Icon name="pencil" size={14} />
          Edit
        </Button>
      )}

      <Button
        className={styles.actionButton}
        variant="text"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        aria-label="Replace file"
      >
        <Icon name="swapHorizontal" size={14} />
        Replace
      </Button>

      <input
        type="file"
        style={{display: "none"}}
        onChange={e => handleReplaceFile(e, file)}
        ref={fileInputRef}
        aria-hidden="true"
      />

      <DeleteFileButton fileId={file._id} onFileDeleted={onDelete} onClose={onClose} />
    </FlexElement>
  );
};
