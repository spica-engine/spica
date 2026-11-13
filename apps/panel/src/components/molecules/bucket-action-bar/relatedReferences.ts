import {relationValueId} from "../../../domain/relationTarget";

export function relatedReferences(
  entry: Record<string, any>,
  relations: Record<string, any>[],
  keyFieldOf: (bucketId: string | undefined) => string | undefined
): string[] {
  return relations.flatMap(({title, bucketId}) => {
    const value = title === undefined ? undefined : entry[title];
    const items = Array.isArray(value) ? value : [value];
    return items.flatMap(item => {
      const id = relationValueId(item, keyFieldOf(bucketId));
      return id ? [`${bucketId}/${id}`] : [];
    });
  });
}
