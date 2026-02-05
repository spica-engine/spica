import {ChangeLog} from "@spica-server/interface/versioncontrol";

export type ChangeLogAggregator = (logs: ChangeLog[]) => ChangeLog[];
