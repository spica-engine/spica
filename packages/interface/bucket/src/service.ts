export interface IndexOptions {
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
  [option: string]: unknown;
}

export interface IndexDefinition {
  definition: {
    [key: string]: any;
  };
  options?: IndexOptions;
  name: string;
}

export interface ExistingIndex {
  v: number;
  key: {
    [key: string]: any;
  };
  name: string;
  [key: string]: any;
}
