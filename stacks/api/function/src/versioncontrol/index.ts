import {FunctionService} from "@spica-server/function/services";
import {SyncProvider} from "@spica-server/versioncontrol";
import {FunctionEngine} from "../engine";
import {LogService} from "@spica-server/function/src/log";
import {dependecySyncProviders} from "./dependency";
import {indexSyncProviders} from "./fnindex";
import {schemaSyncProviders} from "./schema";
import {Dependency} from "@spica-server/interface/function";
import {IRepresentativeManager} from "@spica-server/interface/representative";

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
