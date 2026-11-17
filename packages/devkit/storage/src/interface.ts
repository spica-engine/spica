export interface StorageObject {
  /** @deprecated Read the key with idOf; it is named id on PostgreSQL. */
  _id?: string;
  name: string;
  url: string;
  content: {
    type: string;
    size: number;
  };
}

export interface BufferWithMeta {
  /**
   * string | Buffer | Uint8Array | number[];
   */
  data: any;
  name: string;
  contentType: string;
}
