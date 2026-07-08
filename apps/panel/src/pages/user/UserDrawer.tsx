import React from "react";
import {
  useCreateUserMutation,
  useUpdateUserMutation,
  useAddUserPolicyMutation,
  useRemoveUserPolicyMutation,
  useStartUserFactorVerificationMutation,
  useCompleteUserFactorVerificationMutation,
  useDeleteUserAuthFactorMutation,
  type User,
} from "../../store/api/userApi";
import EntityDrawer from "../../components/organisms/entity-drawer/EntityDrawer";
import TwoFactorSection from "../../components/organisms/two-factor-section/TwoFactorSection";

type UserDrawerProps = {
  isOpen: boolean;
  selectedUser: User | null;
  onClose: () => void;
};

const UserDrawer: React.FC<UserDrawerProps> = ({ isOpen, selectedUser, onClose }) => {
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [addPolicy] = useAddUserPolicyMutation();
  const [removePolicy] = useRemoveUserPolicyMutation();
  const [startVerification, { isLoading: isStarting }] = useStartUserFactorVerificationMutation();
  const [completeVerification, { isLoading: isVerifying }] =
    useCompleteUserFactorVerificationMutation();
  const [disableFactor, { isLoading: isDisabling }] = useDeleteUserAuthFactorMutation();

  return (
    <EntityDrawer<User>
      isOpen={isOpen}
      selectedEntity={selectedUser}
      onClose={onClose}
      entityLabel="User"
      nameField="username"
      createMutation={createUser}
      updateMutation={updateUser}
      addPolicyMutation={addPolicy}
      removePolicyMutation={removePolicy}
      isCreating={isCreating}
      isUpdating={isUpdating}
      extraContent={
        selectedUser?._id ? (
          <TwoFactorSection
            entityId={selectedUser._id}
            enabled={!!selectedUser.authFactor}
            entityNoun="user"
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

export default UserDrawer;
