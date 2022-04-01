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
  module: string;
  getAll: () => Promise<any[]>;
  insert: (doc) => Promise<any>;
  update: (doc) => Promise<any>;
  delete: (doc) => Promise<void>;
}

export interface DocumentProvider {
  module: string;
  getAll: () => Promise<any[]>;
  insert: (rep) => Promise<any>;
  update: (rep) => Promise<any>;
  delete: (rep) => Promise<void>;
}

export interface SyncProvider {
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

export interface VersionManager {
  createBranch(name: string);
  switchBranch(name: string);

  addUpstream(address: string);
  clone(address: string);

  pull(branch: string);
  push(branch: string);

  add(files: string[]);
  commit(message: string);
}
