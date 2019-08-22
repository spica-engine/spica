export interface BucketEntry {
  _id?: string;
  _schedule?: Date;
  [key: string]: any | undefined;
}

export type BucketRow<T = BucketEntry> = T;
export type BucketData<T = BucketRow> = T[];
