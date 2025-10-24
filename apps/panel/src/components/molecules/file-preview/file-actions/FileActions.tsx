import {useRef} from "react";
import {FlexElement, Button, Icon} from "oziko-ui-kit";
import {DeleteFileButton} from "./DeleteFileButton";
import styles from "./FileActions.module.scss";

interface FileActionsProps {
  onCopy: () => void;
  onEdit?: () => void;
  onReplace: (file: File) => void;
  onDelete?: (fileId: string) => void;
  fileId?: string;
  isImage?: boolean;
  isLoading?: boolean;
  onClose?: () => void;
}

export const FileActions = ({
  onCopy,
  onEdit,
  onReplace,
  onDelete,
  fileId,
  isImage,
  isLoading,
  onClose
}: FileActionsProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    onReplace(files[0]);
    e.target.value = "";
  };

  return (
    <FlexElement gap={10}>
      <Button className={styles.actionButton} variant="text" onClick={onCopy}>
        <Icon name="fileMultiple" size={14} />
        Copy
      </Button>
      {isImage && onEdit && (
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
        onChange={handleFileInputChange}
        ref={fileInputRef}
      />
      {fileId && onDelete && onClose && (
        <DeleteFileButton fileId={fileId} onFileDeleted={onDelete} onClose={onClose} />
      )}
    </FlexElement>
  );
};
