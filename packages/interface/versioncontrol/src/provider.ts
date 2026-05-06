export interface VCWatchOptions {
  watchMode: "realtime" | "polling";
  pollingInterval?: number;
}

export const VC_WATCH_OPTIONS = Symbol.for("VC_WATCH_OPTIONS");

export interface VersionControlOptions {
  persistentPath: string;
  isReplicationEnabled: boolean;
  realtime?: boolean;
  watchMode: "realtime" | "polling";
  pollingInterval?: number;
}

export const VERSIONCONTROL_WORKING_DIRECTORY = Symbol.for("VERSIONCONTROL_WORKING_DIRECTORY");
