export interface BucketEntry {
  _id: string;
  [key: string]: any | undefined;
}

export type BucketRow<T = BucketEntry> = T;
export type BucketData<T = BucketRow> = T[];

export const EMPTY_BUCKET_ROW: BucketRow = {
  _id: undefined
};
