import {Filter} from "mongodb";
import {Id} from "@spica-server/interface-data";

interface Document {
  _id: Id;
}

export enum OperationType {
  INSERT = "insert",
  UPDATE = "update",
  REPLACE = "replace",
  PATCH = "patch",
  DELETE = "delete",
  DROP = "drop"
}

export interface DatabaseChange<T extends Document> {
  _id: string;
  operationType: OperationType;
  ns: {
    db: string;
    coll: string;
  };
  documentKey: T;
  updateDescription?: {
    updatedFields?: {
      [key: string]: any;
    };
    removedFields?: string[];
    truncatedArrays?: [
      {
        [key: string]: any;
      }
    ];
  };
  fullDocument?: T;
}

export interface FindOptions<T> {
  filter?: Filter<T>;
  sort?: {
    [index: string]: -1 | 1;
  };
  skip?: number;
  limit?: number;
}
