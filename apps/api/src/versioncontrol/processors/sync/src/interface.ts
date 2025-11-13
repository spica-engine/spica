import {Sync, SyncStatuses} from "@spica-server/interface/versioncontrol";

export type PendingSync = Sync & {status: SyncStatuses.PENDING};
export type ApprovedSync = Sync & {status: SyncStatuses.APPROVED};
