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
  insert: (document: Omit<Singular<T>, "_id">) => void;
  replace: (document: Singular<T> & {_id: string}) => void;
  patch: (document: Partial<Singular<T>> & {_id: string}) => void;
  remove: (document: Partial<Singular<T>> & {_id: string}) => void;
};

export type RealtimeConnectionOne<T> = Observable<T> & {
  replace: (document: Omit<Singular<T>, "_id">) => void;
  patch: (document: Omit<Partial<Singular<T>>, "_id">) => void;
  remove: () => void;
};

type Singular<T> = T extends Array<any> ? T[0] : T;
