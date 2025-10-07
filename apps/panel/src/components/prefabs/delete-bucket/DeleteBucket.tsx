import React, { useState, type FC, type ReactNode } from 'react'
import Confirmation from '../../molecules/confirmation/Confirmation'
import type {BucketType} from "../../../services/bucketService";
import { Icon } from 'oziko-ui-kit';
import styles from "./DeleteBucket.module.scss"
import { useBucket } from '../../../contexts/BucketContext';

type DeleteBucketProps = {
    bucket: BucketType;
    children: (props: { 
        isOpen: boolean;
        onOpen: (e: React.MouseEvent) => void;
        onClose: () => void;
    }) => ReactNode;
}

const DeleteBucket: FC<DeleteBucketProps> = ({ bucket, children }) => {
    const { deleteBucket } = useBucket();
    const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
    
    const handleDeleteBucket = async () => {
        await deleteBucket(bucket._id);
        setIsConfirmationOpen(false);
    };

    const handleCancelConfirmation = () => {
        setIsConfirmationOpen(false);
    };

    const handleOpenConfirmation = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsConfirmationOpen(true);
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
                    title="DELETE BUCKET"
                    description={
                        <>
                            <span className={styles.confirmText}>
                                This action will permanently delete this bucket and remove all associated data and
                                connections. This cannot be undone.
                            </span>
                            <span className={styles.confirmHint}>
                                Please type <strong>{bucket.title}</strong> to confirm deletion.
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
                    confirmCondition={val => val === bucket.title}
                    onConfirm={handleDeleteBucket}
                    onCancel={handleCancelConfirmation}
                />
            )}
        </>
    );
};

export default DeleteBucket;