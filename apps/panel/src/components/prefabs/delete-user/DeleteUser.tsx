import React, { useState, type FC, type ReactNode } from 'react'
import Confirmation from '../../molecules/confirmation/Confirmation'
import type { User } from '../../../store/api/userApi'
import { Icon } from 'oziko-ui-kit'
import { useDeleteUserMutation } from '../../../store/api/userApi'

type DeleteUserProps = {
    user: User;
    onDeleted?: () => void;
    children: (props: {
        isOpen: boolean;
        onOpen: (e: React.MouseEvent) => void;
        onClose: () => void;
    }) => ReactNode;
}

const DeleteUser: FC<DeleteUserProps> = ({ user, onDeleted, children }) => {
    const [deleteUser] = useDeleteUserMutation();
    const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

    const handleDeleteUser = async () => {
        await deleteUser(user._id!);
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
                    title="DELETE USER"
                    description={
                        <>
                            <span>
                                This action will permanently delete this user and revoke all
                                associated access. This cannot be undone.
                            </span>
                            <span>
                                Please type <strong>{user.username}</strong> to confirm deletion.
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
                    confirmCondition={val => val === user.username}
                    onConfirm={handleDeleteUser}
                    onCancel={handleCancelConfirmation}
                />
            )}
        </>
    );
};

export default DeleteUser;
