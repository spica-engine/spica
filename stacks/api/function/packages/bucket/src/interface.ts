import {JSONSchema7, JSONSchema7TypeName} from "json-schema";
import {Observable} from "rxjs";

export interface Bucket {
  _id?: string;
  title: string;
  icon?: string;
  description: string;
  primary: string;
  history?: boolean;
  properties: {
    [key: string]: JSONSchema7 & PropertyOptions;
  };
  order?: number;
}

interface PropertyOptions {
  type: JSONSchema7TypeName | JSONSchema7TypeName[] | string;
  options: {
    translate?: boolean;
    history?: boolean;
    position: "left" | "right" | "bottom";
  };
}

export interface BucketDocument {
  _id?: string;
  [key: string]: any | undefined;
}

export interface Sequence {
  kind: SequenceKind;
  item: string;
  at: number;
  with?: string;
}
export enum SequenceKind {
  Delete = 0,
  Substitute = 1,
  Insert = 2
}

export interface StreamChunk<T = any> {
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

export enum OperationKind {
  INSERT = "insert",
  REPLACE = "replace",
  PATCH = "patch",
  DELETE = "delete"
}

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

export type RealtimeConnection<T> = Observable<T> & {
  insert: (document: Singular<T>) => void;
  replace: (document: Singular<T> & {_id: string}) => void;
  patch: (document: Partial<Singular<T>> & {_id: string}) => void;
  remove: (document: Partial<Singular<T>> & {_id: string}) => void;
};

type Singular<T> = T extends Array<any> ? T[0] : T;
