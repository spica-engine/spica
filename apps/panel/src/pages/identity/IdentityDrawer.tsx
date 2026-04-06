import React from "react";
import {
  useCreateIdentityMutation,
  useUpdateIdentityMutation,
  useAddIdentityPolicyMutation,
  useRemoveIdentityPolicyMutation,
  type Identity,
} from "../../store/api/identityApi";
import EntityDrawer from "../../components/organisms/entity-drawer/EntityDrawer";

type IdentityDrawerProps = {
  isOpen: boolean;
  selectedIdentity: Identity | null;
  onClose: () => void;
};

const IdentityDrawer: React.FC<IdentityDrawerProps> = ({ isOpen, selectedIdentity, onClose }) => {
  const [createIdentity, { isLoading: isCreating }] = useCreateIdentityMutation();
  const [updateIdentity, { isLoading: isUpdating }] = useUpdateIdentityMutation();
  const [addPolicy] = useAddIdentityPolicyMutation();
  const [removePolicy] = useRemoveIdentityPolicyMutation();

  return (
    <EntityDrawer<Identity>
      isOpen={isOpen}
      selectedEntity={selectedIdentity}
      onClose={onClose}
      entityLabel="Identity"
      nameField="identifier"
      createMutation={createIdentity}
      updateMutation={updateIdentity}
      addPolicyMutation={addPolicy}
      removePolicyMutation={removePolicy}
      isCreating={isCreating}
      isUpdating={isUpdating}
    />
  );
};

export default IdentityDrawer;
