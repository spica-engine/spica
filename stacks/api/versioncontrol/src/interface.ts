export const REGISTER_SYNC_PROVIDER = Symbol.for("REGISTER_SYNC_PROVIDER");

export interface IREGISTER_SYNC_PROVIDER {
  manager: IRepresentativeManager;
  register: (provider: SyncProvider) => void;
}

export enum SynchronizationDirection {
  RepresentativeToDatabase,
  DatabaseToRepresentative
}

export interface RepresentativeProvider<R, D> {
  module: string;
  getAll: () => Promise<R[]>;
  insert: (doc: D) => Promise<R>;
  update: (doc: D) => Promise<R>;
  delete: (doc: D) => Promise<void>;
}

export interface DocumentProvider<D, R> {
  module: string;
  getAll: () => Promise<D[]>;
  insert: (rep: R) => Promise<D>;
  update: (rep: R) => Promise<D>;
  delete: (rep: R) => Promise<void>;
}

export interface SyncProvider<R = any, D = any> {
  document: DocumentProvider<D, R>;
  representative: RepresentativeProvider<R, D>;
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
