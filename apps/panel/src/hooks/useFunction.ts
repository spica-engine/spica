import { useCallback } from 'react';
import {
  useGetFunctionsQuery,
  useGetFunctionQuery,
  useCreateFunctionMutation,
  useUpdateFunctionMutation,
  useDeleteFunctionMutation,
  useExecuteFunctionMutation,
  useGetFunctionExecutionsQuery,
  useGetFunctionDependenciesQuery,
  useInstallFunctionDependenciesMutation,
  useGetFunctionTriggersQuery,
  useUpdateFunctionTriggersMutation,
  useInjectEnvVarMutation,
  useEjectEnvVarMutation,
  useInjectSecretMutation,
  useEjectSecretMutation,
  type SpicaFunction,
  type CreateFunctionRequest,
  type UpdateFunctionRequest,
  type FunctionTrigger,
  type ExecuteFunctionRequest,
} from '../store/api/functionApi';

export function useFunctionManagement() {
  const [createFunction, createFunctionResult] = useCreateFunctionMutation();
  const [updateFunction, updateFunctionResult] = useUpdateFunctionMutation();
  const [deleteFunction, deleteFunctionResult] = useDeleteFunctionMutation();
  const [executeFunction, executeFunctionResult] = useExecuteFunctionMutation();

  const handleCreateFunction = useCallback(
    async (functionData: CreateFunctionRequest) => {
      try {
        const result = await createFunction(functionData).unwrap();
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error };
      }
    },
    [createFunction]
  );

  const handleUpdateFunction = useCallback(
    async (id: string, functionData: UpdateFunctionRequest) => {
      try {
        const result = await updateFunction({ id, body: functionData }).unwrap();
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error };
      }
    },
    [updateFunction]
  );

  const handleDeleteFunction = useCallback(
    async (id: string) => {
      try {
        await deleteFunction(id).unwrap();
        return { success: true };
      } catch (error) {
        return { success: false, error };
      }
    },
    [deleteFunction]
  );

  const handleExecuteFunction = useCallback(
    async (id: string, requestData?: ExecuteFunctionRequest) => {
      try {
        const result = await executeFunction({ id, body: requestData }).unwrap();
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error };
      }
    },
    [executeFunction]
  );

  return {
    createFunction: handleCreateFunction,
    updateFunction: handleUpdateFunction,
    deleteFunction: handleDeleteFunction,
    executeFunction: handleExecuteFunction,
    
    isCreating: createFunctionResult.isLoading,
    isUpdating: updateFunctionResult.isLoading,
    isDeleting: deleteFunctionResult.isLoading,
    isExecuting: executeFunctionResult.isLoading,
    
    createError: createFunctionResult.error,
    updateError: updateFunctionResult.error,
    deleteError: deleteFunctionResult.error,
    executeError: executeFunctionResult.error,
    
    executeResult: executeFunctionResult.data,
  };
}

export function useFunctionList(params?: {
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
  } = useGetFunctionsQuery(params);

  return {
    functions: data?.data || [],
    total: data?.meta?.total || 0,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}

export function useFunctionDetails(id: string, options?: { skip?: boolean }) {
  const functionQuery = useGetFunctionQuery(id, { skip: options?.skip });
  const dependenciesQuery = useGetFunctionDependenciesQuery(id, { skip: options?.skip });
  const triggersQuery = useGetFunctionTriggersQuery(id, { skip: options?.skip });

  const [installDependencies] = useInstallFunctionDependenciesMutation();
  const [updateTriggers] = useUpdateFunctionTriggersMutation();
  const [injectEnvVar] = useInjectEnvVarMutation();
  const [ejectEnvVar] = useEjectEnvVarMutation();
  const [injectSecret] = useInjectSecretMutation();
  const [ejectSecret] = useEjectSecretMutation();

  const handleInstallDependencies = useCallback(
    async (dependencies: Record<string, string>) => {
      try {
        const result = await installDependencies({ id, dependencies }).unwrap();
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error };
      }
    },
    [installDependencies, id]
  );

  const handleUpdateTriggers = useCallback(
    async (triggers: FunctionTrigger[]) => {
      try {
        const result = await updateTriggers({ id, triggers }).unwrap();
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error };
      }
    },
    [updateTriggers, id]
  );

  const handleInjectEnvVar = useCallback(
    async (envVarId: string) => {
      try {
        await injectEnvVar({ functionId: id, envVarId }).unwrap();
        return { success: true };
      } catch (error) {
        return { success: false, error };
      }
    },
    [injectEnvVar, id]
  );

  const handleEjectEnvVar = useCallback(
    async (envVarId: string) => {
      try {
        await ejectEnvVar({ functionId: id, envVarId }).unwrap();
        return { success: true };
      } catch (error) {
        return { success: false, error };
      }
    },
    [ejectEnvVar, id]
  );

  const handleInjectSecret = useCallback(
    async (secretId: string) => {
      try {
        await injectSecret({ functionId: id, secretId }).unwrap();
        return { success: true };
      } catch (error) {
        return { success: false, error };
      }
    },
    [injectSecret, id]
  );

  const handleEjectSecret = useCallback(
    async (secretId: string) => {
      try {
        await ejectSecret({ functionId: id, secretId }).unwrap();
        return { success: true };
      } catch (error) {
        return { success: false, error };
      }
    },
    [ejectSecret, id]
  );

  return {
    function: functionQuery.data,
    dependencies: dependenciesQuery.data || {},
    triggers: triggersQuery.data || [],
    envVars: functionQuery.data?.env_vars || [],
    secrets: functionQuery.data?.secrets || [],
    
    isLoadingFunction: functionQuery.isLoading,
    isLoadingDependencies: dependenciesQuery.isLoading,
    isLoadingTriggers: triggersQuery.isLoading,
    
    functionError: functionQuery.error,
    dependenciesError: dependenciesQuery.error,
    triggersError: triggersQuery.error,
    
    installDependencies: handleInstallDependencies,
    updateTriggers: handleUpdateTriggers,
    injectEnvVar: handleInjectEnvVar,
    ejectEnvVar: handleEjectEnvVar,
    injectSecret: handleInjectSecret,
    ejectSecret: handleEjectSecret,
    
    refetchFunction: functionQuery.refetch,
    refetchDependencies: dependenciesQuery.refetch,
    refetchTriggers: triggersQuery.refetch,
  };
}

export function useFunctionExecutions(
  functionId: string,
  params?: {
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
  }
) {
  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useGetFunctionExecutionsQuery({ functionId, ...params });

  return {
    executions: data?.data || [],
    total: data?.meta?.total || 0,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}

export function useFunctionDevelopment(functionId: string) {
  const { function: func, isLoadingFunction } = useFunctionDetails(functionId);
  const { executeFunction, isExecuting, executeResult, executeError } = useFunctionManagement();
  const { executions, refetch: refetchExecutions } = useFunctionExecutions(functionId, {
    limit: 10,
    sort: { startedAt: -1 },
  });

  const handleRunFunction = useCallback(
    async (requestData?: ExecuteFunctionRequest) => {
      const result = await executeFunction(functionId, requestData);
      if (result.success) {
        setTimeout(() => refetchExecutions(), 1000);
      }
      return result;
    },
    [executeFunction, functionId, refetchExecutions]
  );

  return {
    function: func,
    isLoading: isLoadingFunction,
    recentExecutions: executions.slice(0, 5),
    runFunction: handleRunFunction,
    isRunning: isExecuting,
    lastResult: executeResult,
    lastError: executeError,
  };
}

export {
  useGetFunctionsQuery,
  useGetFunctionQuery,
  useCreateFunctionMutation,
  useUpdateFunctionMutation,
  useDeleteFunctionMutation,
  useExecuteFunctionMutation,
  useGetFunctionExecutionsQuery,
  useGetFunctionDependenciesQuery,
  useInstallFunctionDependenciesMutation,
  useGetFunctionTriggersQuery,
  useUpdateFunctionTriggersMutation,
  useInjectEnvVarMutation,
  useEjectEnvVarMutation,
  useInjectSecretMutation,
  useEjectSecretMutation,
  useGetFunctionIndexQuery,
  useUpdateFunctionIndexMutation,
  useGetFunctionInformationQuery,
  useAddFunctionDependencyMutation,
  useDeleteFunctionDependencyMutation,
  useGetFunctionLogsQuery,
  useClearFunctionLogsMutation,
} from '../store/api/functionApi';