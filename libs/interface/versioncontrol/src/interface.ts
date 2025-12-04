import {ObjectId} from "@spica-server/database";
import {Observable} from "rxjs";

export enum ChangeType {
  CREATE,
  UPDATE,
  DELETE
}

export enum ChangeOrigin {
  DOCUMENT,
  REPRESENTATIVE
}

export interface ChangeLog {
  _id?: ObjectId;
  module: string;
  sub_module: string;
  type: ChangeType;
  origin: ChangeOrigin;
  resource_id: string;
  resource_slug: string;
  resource_content: string;
  resource_extension: string;
  created_at: Date;
}

export interface ChangeHandler {
  moduleMeta: ChangeModuleMeta;
  origin: ChangeOrigin;
  supplier: ChangeSupplier;
  applier: ChangeApplier;
}

export interface ChangeModuleMeta {
  module: string;
  subModule: string;
}

export interface ChangeSupplier extends ChangeModuleMeta {
  listen(): Observable<ChangeLog>;
}

export interface RepresentativeChangeSupplier extends ChangeSupplier {}

export interface DocumentChangeSupplier extends ChangeSupplier {}

export interface ChangeApplier extends ChangeModuleMeta {
  apply(change: ChangeLog): Promise<ApplyResult>;
}

export interface DocumentChangeApplier extends ChangeApplier {
  findIdBySlug(slug: string): Promise<string | null>;
  findIdByContent(content: string): Promise<string | null>;
  fileExtensions: string[];
}

export interface RepresentativeChangeApplier extends ChangeApplier {}

export interface IChangeLogProcessor {
  push(changeLog: ChangeLog): Promise<ChangeLog>;
  watch(): Observable<ChangeLog>;
}

export interface ApplyResult {
  status: SyncStatuses;
  reason?: string;
}

export interface ISyncProcessor {
  push(...sync: Sync[]): Promise<Sync[]>;
  update(_id: ObjectId, status: SyncStatuses, reason?: string): Promise<Sync>;
  watch(status?: SyncStatuses): Observable<Sync>;
}

export interface Sync {
  _id?: ObjectId;
  change_log: ChangeLog;
  status: SyncStatuses;
  reason?: string;
  created_at: Date;
  updated_at: Date;
}

export type PendingSync = Sync & {status: SyncStatuses.PENDING};
export type ApprovedSync = Sync & {status: SyncStatuses.APPROVED};

export enum SyncStatuses {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  IN_PROGRESS = "IN_PROGRESS",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED"
}

export type RegisterVCChangeHandler = (
  supplier: DocumentChangeSupplier,
  applier: DocumentChangeApplier
) => void;

export const REGISTER_VC_CHANGE_HANDLER = Symbol.for("REGISTER_VC_CHANGE_HANDLER");

export const VC_REPRESENTATIVE_MANAGER = Symbol.for("VC_REPRESENTATIVE_MANAGER");
