// @owner Kanan Gasimov

import type { BucketType } from "src/store/api/bucketApi";

export function prepareBucketWithoutField(bucket: BucketType, fieldKey: string): BucketType {
    const { [fieldKey]: _removed, ...updatedProperties } = bucket.properties;
    const updatedRequired = bucket.required?.filter(r => r !== fieldKey) ?? [];
    const updatedPrimary = bucket.primary === fieldKey ? 'title' : bucket.primary;
  
    return {
      ...bucket,
      properties: updatedProperties,
      required: updatedRequired,
      primary: updatedPrimary,
    };
  }