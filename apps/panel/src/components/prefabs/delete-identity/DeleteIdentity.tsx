import React, { type FC, type ReactNode } from "react";
import type { Identity } from "../../../store/api/identityApi";
import { useDeleteIdentityMutation } from "../../../store/api/identityApi";
import DeleteEntity from "../delete-entity/DeleteEntity";
import { idOf } from "../../../utils/recordKey";

type DeleteIdentityProps = {
  identity: Identity;
  onDeleted?: () => void;
  children: (props: {
    isOpen: boolean;
    onOpen: (e: React.MouseEvent) => void;
    onClose: () => void;
  }) => ReactNode;
};

const DeleteIdentity: FC<DeleteIdentityProps> = ({ identity, onDeleted, children }) => {
  const [deleteIdentity] = useDeleteIdentityMutation();

  return (
    <DeleteEntity
      entityId={idOf(identity)!}
      entityName={identity.identifier}
      entityLabel="IDENTITY"
      deleteMutation={deleteIdentity}
      onDeleted={onDeleted}
    >
      {children}
    </DeleteEntity>
  );
};

export default DeleteIdentity;
