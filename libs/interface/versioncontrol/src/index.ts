export interface VersionControlOptions {
  persistentPath: string;
  isReplicationEnabled: boolean;
}

export type RegisterSyncProvider = (provider: SyncProvider) => void;

export enum SyncDirection {
  RepToDoc,
  DocToRep
}

export type Provider = RepresentativeProvider | DocumentProvider;

interface RepresentativeProvider {
  getAll: () => Promise<any[]>;
  insert: (doc) => Promise<any>;
  update: (doc) => Promise<any>;
  delete: (doc) => Promise<void>;
}

interface DocumentProvider {
  getAll: () => Promise<any[]>;
  insert: (rep) => Promise<any>;
  update: (rep) => Promise<any>;
  delete: (rep) => Promise<void>;
}

export interface SyncProvider {
  name: string;
  document: DocumentProvider;
  representative: RepresentativeProvider;
  comparisonOptions?: {
    ignoredFields: string[];
    uniqueField: string;
  };
  parents: number;
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

export const VERSIONCONTROL_WORKING_DIRECTORY = Symbol.for("VERSIONCONTROL_WORKING_DIRECTORY");

export const REGISTER_VC_SYNC_PROVIDER = Symbol.for("REGISTER_VC_SYNC_PROVIDER");

export const VC_REP_MANAGER = Symbol.for("VC_REP_MANAGER");
