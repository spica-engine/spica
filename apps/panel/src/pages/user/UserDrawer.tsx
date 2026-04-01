import React from "react";
import {
  useCreateUserMutation,
  useUpdateUserMutation,
  useAddUserPolicyMutation,
  useRemoveUserPolicyMutation,
  type User,
} from "../../store/api/userApi";
import EntityDrawer from "../../components/organisms/entity-drawer/EntityDrawer";

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
    />
  );
};

export default UserDrawer;
