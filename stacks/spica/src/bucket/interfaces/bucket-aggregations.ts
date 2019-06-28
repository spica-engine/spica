export interface BucketAggregations {
  filter: any;
  sort: {active: string; direction: number | string};
}
export function emptyBucketAggregations(): BucketAggregations {
  return {filter: undefined, sort: {active: undefined, direction: undefined}};
}
