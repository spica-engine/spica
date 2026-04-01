import React, { type FC, type ReactNode } from "react";
import type { User } from "../../../store/api/userApi";
import { useDeleteUserMutation } from "../../../store/api/userApi";
import DeleteEntity from "../delete-entity/DeleteEntity";

type DeleteUserProps = {
  user: User;
  onDeleted?: () => void;
  children: (props: {
    isOpen: boolean;
    onOpen: (e: React.MouseEvent) => void;
    onClose: () => void;
  }) => ReactNode;
};

const DeleteUser: FC<DeleteUserProps> = ({ user, onDeleted, children }) => {
  const [deleteUser] = useDeleteUserMutation();

  return (
    <DeleteEntity
      entityId={user._id!}
      entityName={user.username}
      entityLabel="USER"
      deleteMutation={deleteUser}
      onDeleted={onDeleted}
    >
      {children}
    </DeleteEntity>
  );
};

export default DeleteUser;
