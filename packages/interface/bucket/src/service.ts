import {CreateIndexOptions} from "@spica-server/database-driver";

export interface IndexDefinition {
  definition: {
    [key: string]: any;
  };
  options?: CreateIndexOptions;
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
