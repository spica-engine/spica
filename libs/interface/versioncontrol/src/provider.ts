export interface VersionControlOptions {
  persistentPath: string;
  isReplicationEnabled: boolean;
}

export const VERSIONCONTROL_WORKING_DIRECTORY = Symbol.for("VERSIONCONTROL_WORKING_DIRECTORY");
