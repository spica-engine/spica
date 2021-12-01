import {FilterQuery, ObjectId} from "mongodb";
import {Sequence} from "./levenshtein";

interface Document {
  _id: string | ObjectId;
}

export interface StreamChunk<T extends Document> {
  kind: ChunkKind;
  document?: T;
  sequence?: Sequence[];
}

export enum ChunkKind {
  Error = -1,
  Initial = 0,
  EndOfInitial = 1,
  Insert = 2,
  Delete = 3,
  Expunge = 4,
  Update = 5,
  Replace = 6,
  Order = 7,
  Response = 8
}

export enum DatabaseChangeType {
  INSERT = "insert",
  UPDATE = "update",
  REPLACE = "replace",
  DELETE = "delete",
  DROP = "drop"
}

export interface DatabaseChange<T extends Document> {
  _id: string;
  operationType: DatabaseChangeType;
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
  filter?: FilterQuery<T>;
  sort?: {
    [index: string]: -1 | 1;
  };
  skip?: number;
  limit?: number;
}
