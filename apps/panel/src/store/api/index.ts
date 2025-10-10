export { baseApi } from './baseApi';

export { 
  identityApi,
  identityApiReducerPath,
  identityApiMiddleware,
  useGetIdentitiesQuery,
  useGetIdentityQuery,
  useCreateIdentityMutation,
  useUpdateIdentityMutation,
  useDeleteIdentityMutation,
  useAuthenticateIdentityMutation,
  useVerifyIdentityQuery,
  useGetIdentityPoliciesQuery,
  useUpdateIdentityPoliciesMutation,
} from './identityApi';

export type {
  Identity,
  IdentityListResponse,
  CreateIdentityRequest,
  UpdateIdentityRequest,
} from './identityApi';

export {
  functionApi,
  functionApiReducerPath,
  functionApiMiddleware,
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
  useGetFunctionEnvQuery,
  useUpdateFunctionEnvMutation,
} from './functionApi';

export type {
  SpicaFunction,
  FunctionTrigger,
  FunctionExecution,
  FunctionListResponse,
  FunctionExecutionListResponse,
  CreateFunctionRequest,
  UpdateFunctionRequest,
  ExecuteFunctionRequest,
} from './functionApi';

export {
  useIdentityManagement,
  useIdentityList,
  useIdentityDetails,
  useAuthState,
} from '../../hooks/useIdentity';

export {
  useFunctionManagement,
  useFunctionList,
  useFunctionDetails,
  useFunctionExecutions,
  useFunctionDevelopment,
} from '../../hooks/useFunction';