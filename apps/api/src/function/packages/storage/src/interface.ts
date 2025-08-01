export interface StorageObject {
  _id: string;
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

export interface ResumableUploadOptions {
  publicUrl: string;
  authorization: string;
  object: File | BufferWithMeta;
  headers: Record<string, string>;
  onError(error: Error): void;
  onProgress(bytesUploaded: number, bytesTotal: number): void;
  onSuccess(): void;
}
