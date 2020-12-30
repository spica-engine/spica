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