import {Observable} from "rxjs";

export interface ChangeLog {
  module: string;
  sub_module: string;
  type: string;
  origin: string;
  resource_id: string;
  resource_slug: string;
  resource_content: string;
  created_at: Date;
}

export interface ChangeHandler {
  moduleMeta: ChangeModuleMeta;
  origin: string;
  supplier: ChangeSupplier;
  applier: ChangeApplier;
}

export interface ChangeModuleMeta {
  module: string;
  subModule: string;
  fileExtension: string;
}

export interface ChangeSupplier extends ChangeModuleMeta {
  listen(): Observable<ChangeLog>;
}

export interface ChangeApplier extends ChangeModuleMeta {
  apply(change: ChangeLog): Promise<ApplyResult>;
}

export interface ChangeLogProcessor {
  push(changeLog: ChangeLog): Promise<void>;
  watch(): Observable<ChangeLog>;
}

export interface ApplyResult {
  status: "succeeded" | "failed";
  reason?: string;
}

export interface SyncProcessor {
  push(sync: Sync): Promise<Sync>;
  update(sync: Sync, status: SyncStatuses, reason?: string): Promise<Sync>;
  watch(): Observable<Sync>;
}

export interface Sync {
  change_log: ChangeLog;
  status: SyncStatuses;
  reason?: string;
  created_at: Date;
  updated_at: Date;
}

export enum SyncStatuses {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  IN_PROGRESS = "in_progress",
  SUCCEEDED = "succeeded",
  FAILED = "failed"
}
