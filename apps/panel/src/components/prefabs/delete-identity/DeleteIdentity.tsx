import React, { useState, type FC, type ReactNode } from 'react'
import Confirmation from '../../molecules/confirmation/Confirmation'
import type { Identity } from '../../../store/api/identityApi'
import { Icon } from 'oziko-ui-kit'
import { useDeleteIdentityMutation } from '../../../store/api/identityApi'

type DeleteIdentityProps = {
    identity: Identity;
    onDeleted?: () => void;
    children: (props: {
        isOpen: boolean;
        onOpen: (e: React.MouseEvent) => void;
        onClose: () => void;
    }) => ReactNode;
}

const DeleteIdentity: FC<DeleteIdentityProps> = ({ identity, onDeleted, children }) => {
    const [deleteIdentity] = useDeleteIdentityMutation();
    const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

    const handleDeleteIdentity = async () => {
        await deleteIdentity(identity._id!);
        setIsConfirmationOpen(false);
        onDeleted?.();
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
                    title="DELETE IDENTITY"
                    description={
                        <>
                            <span>
                                This action will permanently delete this identity and revoke all
                                associated access. This cannot be undone.
                            </span>
                            <span>
                                Please type <strong>{identity.identifier}</strong> to confirm deletion.
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
                    confirmCondition={val => val === identity.identifier}
                    onConfirm={handleDeleteIdentity}
                    onCancel={handleCancelConfirmation}
                />
            )}
        </>
    );
};

export default DeleteIdentity;
