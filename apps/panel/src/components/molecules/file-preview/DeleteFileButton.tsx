import {memo, useState} from "react";
import {Button, Icon} from "oziko-ui-kit";
import {useDeleteStorageItemMutation} from "../../../store/api";
import Confirmation from "../confirmation/Confirmation";
import styles from "./FilePreview.module.scss";

interface DeleteFileButtonProps {
  fileId: string;
  onFileDeleted: (fileId: string) => void;
  onClose: () => void;
}

export const DeleteFileButton = memo(({fileId, onFileDeleted, onClose}: DeleteFileButtonProps) => {
  const [deleteStorageItem] = useDeleteStorageItemMutation();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    try {
      setDeleteLoading(true);
      setDeleteError(null);
      await deleteStorageItem(fileId).unwrap();
      onFileDeleted(fileId);
      setShowDeleteConfirmation(false);
      onClose();
    } catch (error) {
      console.error("File deletion failed:", error);
      setDeleteError(error instanceof Error ? error.message : "Failed to delete file");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirmation(false);
    setDeleteError(null);
  };

  return (
    <>
      <Button
        className={`${styles.metadataButton} ${styles.metadataClearButton}`}
        color="danger"
        onClick={() => setShowDeleteConfirmation(true)}
      >
        <Icon name="delete" size={14} />
        Delete
      </Button>
      {showDeleteConfirmation && (
        <Confirmation
          title="DELETE FILE"
          inputPlaceholder="Type Here"
          description={
            <>
              <span className={styles.confirmText}>
                This action will permanently delete the file.
              </span>
              <span>
                Please type <strong>agree</strong> to confirm deletion.
              </span>
            </>
          }
          confirmLabel={
            <>
              <Icon name="delete" />
              Delete
            </>
          }
          cancelLabel={
            <>
              <Icon name="close" />
              Cancel
            </>
          }
          confirmCondition={input => input === "agree"}
          showInput={true}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          loading={deleteLoading}
          error={deleteError}
        />
      )}
    </>
  );
});