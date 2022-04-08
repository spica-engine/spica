export const REGISTER_SYNC_PROVIDER = Symbol.for("REGISTER_SYNC_PROVIDER");
export const WORKING_DIR = Symbol.for("WORKING_DIR");

export interface RegisterSyncProvider {
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
  parents: number;
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

  rm(module: string, id: string): Promise<void>;
}

export interface AvailableCommands {
  [command: string]: {
    required?: boolean;
    type: string;
    items?: {
      type: string;
    };
  };
}

export abstract class VersionManager {
  abstract availables(): AvailableCommands;
  abstract exec(cmd: string, options: {args?: string[]}): Promise<any>;
}

export interface SyncLog {
  resources: {
    module: string;
    insertions: any[];
    updations: any[];
    deletions: any[];
  }[];
  date: string;
}
