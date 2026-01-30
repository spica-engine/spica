export { baseApi } from './baseApi';

export {
  authApi,
  useGetStrategiesQuery,
  useLoginMutation,
  useLogoutMutation,
} from './authApi';

export type {
  Strategy,
  LoginRequest,
  LoginResponse,
} from './authApi';

export {
  authenticationStrategyApi,
  authenticationStrategyApiReducerPath,
  authenticationStrategyApiMiddleware,
  useGetAuthenticationStrategiesQuery,
  useLazyGetAuthenticationStrategiesQuery,
  useGetAuthenticationStrategyQuery,
  useLazyGetAuthenticationStrategyQuery,
} from './authenticationStrategyApi';

export type {
  AuthenticationStrategy,
  AuthenticationStrategyListResponse,
  AuthenticationStrategyOptions,
} from './authenticationStrategyApi';

export {
  bucketApi,
  bucketApiReducerPath,
  bucketApiMiddleware,
  useGetBucketsQuery,
  useGetBucketDataQuery,
  useCreateBucketMutation,
  useUpdateBucketMutation,
  useDeleteBucketMutation,
  useChangeBucketCategoryMutation,
  useUpdateBucketOrderMutation,
  useCreateBucketFieldMutation,
  useUpdateBucketRulesMutation,
  useDeleteBucketHistoryMutation,
  useUpdateBucketHistoryMutation,
  useUpdateBucketReadonlyMutation,
  useRenameBucketMutation,
  useUpdateBucketLimitationMutation,
  useUpdateBucketLimitationFieldsMutation,
} from './bucketApi';

export type {
  BucketType,
  BucketDataType,
  BucketDataQueryType,
  BucketDataWithIdType,
  Property,
  CreateBucketRequest,
  UpdateBucketRequest,
  BucketListResponse,
} from './bucketApi';

export {
  batchApi,
  batchApiReducerPath,
  batchApiMiddleware,
  useExecuteBatchMutation,
} from './batchApi';

export type {
  BatchRequestMethod,
  BatchRequestItem,
  BatchRequestPayload,
  BatchResponse,
  BatchResponseItem,
} from './batchApi';

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
  apiKeyApi,
  apiKeyApiReducerPath,
  apiKeyApiMiddleware,
  useGetApiKeysQuery,
  useGetApiKeyQuery,
  useCreateApiKeyMutation,
  useUpdateApiKeyMutation,
  useDeleteApiKeyMutation,
  useGetApiKeyPoliciesQuery,
  useUpdateApiKeyPoliciesMutation,
} from './apiKeyApi';

export type {
  ApiKey,
  ApiKeyListResponse,
  ApiKeyOptions,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
} from './apiKeyApi';

export {
  dashboardApi,
  dashboardApiReducerPath,
  dashboardApiMiddleware,
  useGetDashboardsQuery,
  useLazyGetDashboardsQuery,
} from './dashboardApi';

export type {
  Dashboard,
  DashboardListResponse,
  DashboardOptions,
} from './dashboardApi';

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

export {
  useBucket,
} from '../../hooks/useBucket';

export {
  storageApi,
  useGetStorageItemsQuery,
  useGetStorageItemQuery,
  useUploadFilesMutation,
  useUpdateStorageItemMutation,
  useDeleteStorageItemMutation,
  useUpdateStorageNameMutation,
  useGetSubResourcesQuery,
} from './storageApi';

export type {
  Storage,
  StorageListResponse,
  StorageOptions,
  UploadFilesRequest,
  UpdateStorageItemRequest,
  UpdateStorageNameRequest,
} from './storageApi';

export {
  useStorageData,
  useStorageItem,
} from '../../hooks/useStorageData';

export { default as useStorageService } from '../../hooks/useStorage';
