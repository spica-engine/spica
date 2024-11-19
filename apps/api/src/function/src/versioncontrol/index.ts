import {FunctionService} from "@spica/api/src/function/services";
import {SyncProvider} from "@spica/api/src/versioncontrol";
import {FunctionEngine} from "../engine";
import {LogService} from "@spica/api/src/function/src/log";
import {dependecySyncProviders} from "./dependency";
import {indexSyncProviders} from "./fnindex";
import {schemaSyncProviders} from "./schema";
import {Dependency} from "@spica/interface";
import {IRepresentativeManager} from "@spica/interface";

export const getSyncProviders = (
  service: FunctionService,
  manager: IRepresentativeManager,
  engine: FunctionEngine,
  logs: LogService
): SyncProvider[] => {
  const schema = schemaSyncProviders(service, manager, engine, logs);
  const index = indexSyncProviders(service, manager, engine);
  const dependency = dependecySyncProviders(service, manager, engine);

  return [schema, index, dependency];
};
