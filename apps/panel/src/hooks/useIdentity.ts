import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  useGetIdentitiesQuery,
  useGetIdentityQuery,
  useCreateIdentityMutation,
  useUpdateIdentityMutation,
  useDeleteIdentityMutation,
  useAuthenticateIdentityMutation,
  useVerifyIdentityQuery,
  useGetIdentityPoliciesQuery,
  useUpdateIdentityPoliciesMutation,
  type Identity,
  type CreateIdentityRequest,
  type UpdateIdentityRequest,
} from '../store/api/identityApi';
import { setToken } from '../store';

export function useIdentityManagement() {
  const dispatch = useDispatch();
  const [createIdentity, createIdentityResult] = useCreateIdentityMutation();
  const [updateIdentity, updateIdentityResult] = useUpdateIdentityMutation();
  const [deleteIdentity, deleteIdentityResult] = useDeleteIdentityMutation();
  const [authenticate, authenticateResult] = useAuthenticateIdentityMutation();

  const handleCreateIdentity = useCallback(
    async (identityData: CreateIdentityRequest) => {
      try {
        const result = await createIdentity(identityData).unwrap();
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error };
      }
    },
    [createIdentity]
  );

  const handleUpdateIdentity = useCallback(
    async (id: string, identityData: UpdateIdentityRequest) => {
      try {
        const result = await updateIdentity({ id, body: identityData }).unwrap();
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error };
      }
    },
    [updateIdentity]
  );

  const handleDeleteIdentity = useCallback(
    async (id: string) => {
      try {
        await deleteIdentity(id).unwrap();
        return { success: true };
      } catch (error) {
        return { success: false, error };
      }
    },
    [deleteIdentity]
  );

  const handleAuthentication = useCallback(
    async (credentials: { identifier: string; password: string }) => {
      try {
        const result = await authenticate(credentials).unwrap();
        // Store token in Redux store (which also persists to localStorage)
        dispatch(setToken(result.token));
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error };
      }
    },
    [authenticate, dispatch]
  );

  return {
    createIdentity: handleCreateIdentity,
    updateIdentity: handleUpdateIdentity,
    deleteIdentity: handleDeleteIdentity,
    authenticate: handleAuthentication,
    
    isCreating: createIdentityResult.isLoading,
    isUpdating: updateIdentityResult.isLoading,
    isDeleting: deleteIdentityResult.isLoading,
    isAuthenticating: authenticateResult.isLoading,
    
    createError: createIdentityResult.error,
    updateError: updateIdentityResult.error,
    deleteError: deleteIdentityResult.error,
    authError: authenticateResult.error,
  };
}

export function useIdentityList(params?: {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  filter?: Record<string, any>;
}) {
  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useGetIdentitiesQuery(params);

  return {
    identities: data?.data || [],
    total: data?.meta?.total || 0,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}

export function useIdentityDetails(id: string, options?: { skip?: boolean }) {
  const identityQuery = useGetIdentityQuery(id, { skip: options?.skip });
  const policiesQuery = useGetIdentityPoliciesQuery(id, { skip: options?.skip });
  const [updatePolicies] = useUpdateIdentityPoliciesMutation();

  const handleUpdatePolicies = useCallback(
    async (policies: string[]) => {
      try {
        const result = await updatePolicies({ id, policies }).unwrap();
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error };
      }
    },
    [updatePolicies, id]
  );

  return {
    identity: identityQuery.data,
    policies: policiesQuery.data || [],
    isLoadingIdentity: identityQuery.isLoading,
    isLoadingPolicies: policiesQuery.isLoading,
    identityError: identityQuery.error,
    policiesError: policiesQuery.error,
    updatePolicies: handleUpdatePolicies,
    refetchIdentity: identityQuery.refetch,
    refetchPolicies: policiesQuery.refetch,
  };
}

export function useAuthState() {
  const { data: identity, error, isLoading } = useVerifyIdentityQuery();

  return {
    identity,
    isAuthenticated: !!identity && !error,
    isLoading,
    error,
  };
}

export {
  useGetIdentitiesQuery,
  useGetIdentityQuery,
  useCreateIdentityMutation,
  useUpdateIdentityMutation,
  useDeleteIdentityMutation,
  useAuthenticateIdentityMutation,
  useVerifyIdentityQuery,
  useGetIdentityPoliciesQuery,
  useUpdateIdentityPoliciesMutation,
} from '../store/api/identityApi';