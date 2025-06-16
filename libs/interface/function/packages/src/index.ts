import {Observable} from "rxjs";

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
