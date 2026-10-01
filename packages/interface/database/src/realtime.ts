/**
 * `bson`, not `mongodb`: the neutral contract must not be written in the Mongo driver's types (D28). An id
 * is a BSON value and `bson` is where it comes from — importing it through `mongodb` also risks holding a
 * second module instance of the class, which is the trap `isId()` exists for.
 */
import {ObjectId} from "bson";

interface Document {
  _id: ObjectId;
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
  /**
   * The realtime subscription filter. Spelled structurally rather than as the Mongo driver's `Filter<T>`:
   * the realtime layer evaluates it with `mingo`, so it is a plain query document either way, and the
   * contract owes nothing to that driver's type (D28). The same shape as the driver's `DocumentFilter`.
   */
  filter?: Record<string, any> | Partial<T>;
  sort?: {
    [index: string]: -1 | 1;
  };
  skip?: number;
  limit?: number;
}
