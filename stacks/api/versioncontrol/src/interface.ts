export const REGISTER_SYNC_PROVIDER = Symbol.for("REGISTER_SYNC_PROVIDER");
export const WORKING_DIR = Symbol.for("WORKING_DIR");

export interface IREGISTER_SYNC_PROVIDER {
  manager: IRepresentativeManager;
  register: (provider: SyncProvider) => void;
}

export enum SyncDirection {
  RepToDoc,
  DocToRep
}

export type Provider = RepresentativeProvider | DocumentProvider;

export interface RepresentativeProvider {
  getAll: () => Promise<any[]>;
  insert: (doc) => Promise<any>;
  update: (doc) => Promise<any>;
  delete: (doc) => Promise<void>;
}

export interface DocumentProvider {
  getAll: () => Promise<any[]>;
  insert: (rep) => Promise<any>;
  update: (rep) => Promise<any>;
  delete: (rep) => Promise<void>;
}

export interface SyncProvider {
  name: string;
  document: DocumentProvider;
  representative: RepresentativeProvider;
}

export interface IRepresentativeManager {
  write(
    module: string,
    id: string,
    fileName: string,
    content: any,
    extension: string
  ): Promise<void>;

  read(
    module: string,
    resNameValidator: (name: string) => boolean,
    fileNameFilter: string[]
  ): Promise<{_id: string; contents: {[key: string]: any}}[]>;

  delete(module: string, id: string): Promise<void>;
}

export abstract class VersionManager {
  abstract run(action: string, options: any): Promise<any>;

  abstract checkout(options: {branch: string}): Promise<any>;
  abstract commit(options: {files: string | string[]; message: string}): Promise<any>;
  abstract reset(options: {files: string | string[]}): Promise<any>;

  // remote
  abstract getRemote();
  abstract setRemote(options: {url: string});

  abstract clone(options: {address: string});
  abstract pull();
  abstract push();
}

export interface SyncLog {
  changes: {
    module: string;
    insertions: any[];
    updations: any[];
    deletions: any[];
  }[];
  date: string;
}
