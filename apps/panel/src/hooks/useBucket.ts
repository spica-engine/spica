import { useCallback } from 'react';
import { bucketApi } from '../store/api/bucketApi';
import type {
  BucketType,
  BucketDataType,
  BucketDataQueryType,
  CreateBucketRequest,
  UpdateBucketRequest,
} from '../store/api/bucketApi';

/**
 * useBucket: Simplified hook that re-exports RTK Query hooks for bucket operations.
 * 
 * This replaces the old BucketContext approach. With RTK Query, we get:
 * - Automatic global state management
 * - Built-in loading/error states
 * - Automatic cache invalidation
 * - Optimistic updates
 * 
 * Usage:
 * ```tsx
 * const { 
 *   useGetBucketsQuery,
 *   useCreateBucketMutation,
 *   // ... other hooks
 * } = useBucket();
 * 
 * // In component:
 * const { data: buckets, isLoading } = useGetBucketsQuery();
 * const [createBucket] = useCreateBucketMutation();
 * ```
 */
export const useBucket = () => {
  return {
    // RTK Query hooks - use these directly in components
    useGetBucketsQuery: bucketApi.useGetBucketsQuery,
    useGetBucketDataQuery: bucketApi.useGetBucketDataQuery,
    useCreateBucketMutation: bucketApi.useCreateBucketMutation,
    useUpdateBucketMutation: bucketApi.useUpdateBucketMutation,
    useDeleteBucketMutation: bucketApi.useDeleteBucketMutation,
    useChangeBucketCategoryMutation: bucketApi.useChangeBucketCategoryMutation,
    useUpdateBucketOrderMutation: bucketApi.useUpdateBucketOrderMutation,
    useCreateBucketFieldMutation: bucketApi.useCreateBucketFieldMutation,
    useUpdateBucketRulesMutation: bucketApi.useUpdateBucketRulesMutation,
    useDeleteBucketHistoryMutation: bucketApi.useDeleteBucketHistoryMutation,
    useUpdateBucketHistoryMutation: bucketApi.useUpdateBucketHistoryMutation,
    useUpdateBucketReadonlyMutation: bucketApi.useUpdateBucketReadonlyMutation,
    useRenameBucketMutation: bucketApi.useRenameBucketMutation,
    useUpdateBucketLimitationMutation: bucketApi.useUpdateBucketLimitationMutation,
    useUpdateBucketLimitationFieldsMutation: bucketApi.useUpdateBucketLimitationFieldsMutation,
    
    // Lazy query hooks for manual triggering
    useLazyGetBucketsQuery: bucketApi.useLazyGetBucketsQuery,
    useLazyGetBucketDataQuery: bucketApi.useLazyGetBucketDataQuery,
    
    // Prefetch functions
    prefetchBuckets: bucketApi.usePrefetch('getBuckets'),
    prefetchBucketData: bucketApi.usePrefetch('getBucketData'),
    
    // Utility functions
    invalidateBuckets: () => bucketApi.util.invalidateTags(['Bucket']),
    invalidateBucketData: (bucketId?: string) => {
      if (bucketId) {
        return bucketApi.util.invalidateTags([{ type: 'BucketData', id: bucketId }]);
      }
      return bucketApi.util.invalidateTags(['BucketData']);
    },
  };
};

// For backward compatibility, also export the individual hooks directly
export const {
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
} = bucketApi;

export default useBucket;