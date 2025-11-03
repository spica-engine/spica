import { Icon } from 'oziko-ui-kit';
import React, { useState, type ReactNode, type FC } from 'react'
import Confirmation from '../../molecules/confirmation/Confirmation';
import { useDeleteBucketFieldMutation } from '../../../store/api/bucketApi';

interface DeleteFieldProps {
    field: any; // TODO: add type
    bucket: {_id: string; title: string};
    children: (props: { 
        isOpen: boolean;
        onOpen: (e: React.MouseEvent) => void;
        onClose: () => void;
    }) => ReactNode;
}

const DeleteField: FC<DeleteFieldProps> = ({ field, bucket, children }) => {
    const [deleteBucketField] = useDeleteBucketFieldMutation();
    const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

    const handleCancelConfirmation = () => {
        setIsConfirmationOpen(false);
    };

    const handleOpenConfirmation = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsConfirmationOpen(true);
    };

    const confirmDelete = async () => {
        const fieldKey = field.path || field.title;
        await deleteBucketField({ bucketId: bucket._id, fieldKey });
        setIsConfirmationOpen(false);
    };

    const getFieldDisplayName = () => {
      const path = field.path || field.title;
      const parts = path.split(".");
      return parts[parts.length - 1];
    };

  return (
   <>
     {children({
        isOpen: isConfirmationOpen,
        onOpen: handleOpenConfirmation,
        onClose: handleCancelConfirmation
    })}
    {isConfirmationOpen && (
        <Confirmation
          title="DELETE FIELD"
          description={
            <>
              <span>
                Are you sure you want to delete the field <strong>"{getFieldDisplayName()}"</strong>?
              </span>
              <span>
                This action will remove the field from bucket entries. Please confirm this action to
                continue.
              </span>
              <span>
                Please type <strong>agree</strong> to confirm deletion.
              </span>
            </>
          }
          inputPlaceholder="Type Here"
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
          showInput
          confirmCondition={val => val === "agree"}
          onConfirm={confirmDelete}
          onCancel={handleCancelConfirmation}
        />
      )}
   </>
  )
}

export default DeleteField