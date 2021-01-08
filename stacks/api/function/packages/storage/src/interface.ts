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

type Base64 = string;

export interface Base64WithMeta {
  data: Base64;
  name: string;
  contentType: string;
}
