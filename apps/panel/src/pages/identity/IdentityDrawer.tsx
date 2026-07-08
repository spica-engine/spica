import React from "react";
import {
  useCreateIdentityMutation,
  useUpdateIdentityMutation,
  useAddIdentityPolicyMutation,
  useRemoveIdentityPolicyMutation,
  useStartFactorVerificationMutation,
  useCompleteFactorVerificationMutation,
  useDeleteAuthFactorMutation,
  type Identity,
} from "../../store/api/identityApi";
import EntityDrawer from "../../components/organisms/entity-drawer/EntityDrawer";
import TwoFactorSection from "../../components/organisms/two-factor-section/TwoFactorSection";

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
  const [startVerification, { isLoading: isStarting }] = useStartFactorVerificationMutation();
  const [completeVerification, { isLoading: isVerifying }] = useCompleteFactorVerificationMutation();
  const [disableFactor, { isLoading: isDisabling }] = useDeleteAuthFactorMutation();

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
      extraContent={
        selectedIdentity?._id ? (
          <TwoFactorSection
            entityId={selectedIdentity._id}
            enabled={!!selectedIdentity.authFactor}
            entityNoun="identity"
            startVerification={startVerification}
            completeVerification={completeVerification}
            disableFactor={disableFactor}
            isStarting={isStarting}
            isVerifying={isVerifying}
            isDisabling={isDisabling}
          />
        ) : undefined
      }
    />
  );
};

export default IdentityDrawer;
