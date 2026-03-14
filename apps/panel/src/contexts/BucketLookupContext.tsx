/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import { createContext, useContext } from 'react';

export interface BucketLookup {
  getTitleById(id: string): string | undefined;
  
  getRelationLabel(bucketId: string, documentId: string): string | null;
  
  setRelationLabel(bucketId: string, documentId: string, label: string): void;
  
  getBucketProperties(bucketId: string): Record<string, any> | undefined;
}

export const BucketLookupContext = createContext<BucketLookup | undefined>(undefined);

export function useBucketLookup(): BucketLookup {
  const lookup = useContext(BucketLookupContext);
  
  if (!lookup) {
    throw new Error('useBucketLookup must be used within a BucketLookupContext.Provider');
  }
  
  return lookup;
}

