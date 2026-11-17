import type {Property} from "src/store/api/bucketApi";

export function collectBucketIds(
  properties: Record<string, Property>,
  cellValue: any
): Array<{bucketId: string; stateKey: string; value: any}> {
  const collected: Array<{bucketId: string; stateKey: string; value: any}> = [];

  function traverse(property: Property, value: any, topLevelKey?: string) {
    if (!property || typeof property !== "object") return;
    
    if (property.type === "relation") {
      const relationValue = value?.[property.title];
      const bucketId = property.bucketId as string;
      collected.push({bucketId, stateKey: topLevelKey ?? bucketId, value: relationValue});
    }
    
    if (property.type === "object" || property.type === "array") {
      for (const prop of Object.values(
        property.properties || property.items?.properties || {}
      )) {
        const childValue = value?.[(prop as Property).title];
        if (prop && (typeof childValue === "object" || !childValue)) {
          traverse(prop as Property, childValue);
        }
      }
    }
  }

  for (const [fieldKey, prop] of Object.entries(properties || {})) {
    traverse(prop, cellValue, fieldKey);
  }
  
  return collected;
}
