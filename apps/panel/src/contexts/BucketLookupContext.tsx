import { createContext, useContext } from 'react';

/**
 * Lookup service interface for resolving bucket information.
 * This enables dependency injection without tight coupling to RTK Query or Redux.
 */
export interface BucketLookup {
  /**
   * Resolves a bucket ID to its title.
   * @param id - The bucket ID to look up
   * @returns The bucket title, or undefined if not found
   */
  getTitleById(id: string): string | undefined;
  
  /**
   * Gets cached relation label for a document in a bucket.
   * @param bucketId - The bucket ID
   * @param documentId - The document ID
   * @returns The cached label, or null if not found
   */
  getRelationLabel(bucketId: string, documentId: string): string | null;
  
  /**
   * Caches a relation label for a document in a bucket.
   * @param bucketId - The bucket ID
   * @param documentId - The document ID
   * @param label - The label to cache
   */
  setRelationLabel(bucketId: string, documentId: string, label: string): void;
  
  /**
   * Gets bucket properties for a given bucket ID.
   * @param bucketId - The bucket ID
   * @returns The bucket properties, or undefined if not found
   */
  getBucketProperties(bucketId: string): Record<string, any> | undefined;
}

/**
 * Context for providing bucket lookup capabilities.
 * This is NOT for state management - it's for dependency injection of read-only lookup functions.
 */
export const BucketLookupContext = createContext<BucketLookup | undefined>(undefined);

/**
 * Hook to access the bucket lookup service.
 * Must be used within a BucketLookupContext.Provider.
 * @throws Error if used outside of provider
 */
export function useBucketLookup(): BucketLookup {
  const lookup = useContext(BucketLookupContext);
  
  if (!lookup) {
    throw new Error('useBucketLookup must be used within a BucketLookupContext.Provider');
  }
  
  return lookup;
}

