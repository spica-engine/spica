interface InitializeOptions {
  publicUrl?: string;
}

export interface ApikeyInitialization extends InitializeOptions {
  apikey: string;
}

export interface IdentityInitialization extends InitializeOptions {
  identity: string;
}

export interface InitializationResult {
  authorization: string;
  publicUrl: string;
}

export interface IndexResult<T> {
  meta: {
    total: number;
  };
  data: T[];
}

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
  data: string | Buffer | Uint8Array | number[];
  name: string;
  contentType: string;
}
