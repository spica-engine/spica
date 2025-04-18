import {CreateIndexesOptions} from "@spica-server/database";

export interface IndexDefinition {
  definition: {
    [key: string]: any;
  };
  options?: CreateIndexesOptions;
}

export interface ExistingIndex {
  v: number;
  key: {
    [key: string]: any;
  };
  name: string;
  [key: string]: any;
}
