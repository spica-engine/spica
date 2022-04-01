import {FunctionService} from "@spica-server/function/services";
import {RepresentativeManager, SyncProvider} from "@spica-server/machinery";
import {FunctionEngine} from "../engine";
import {LogService} from "@spica-server/function/src/log";
import {dependecySyncProviders} from "./dependency";
import {indexSyncProviders} from "./fnindex";
import {schemaSyncProviders} from "./schema";

export const getSyncProviders = (
  service: FunctionService,
  manager: RepresentativeManager,
  engine: FunctionEngine,
  logs: LogService
): SyncProvider[] => {
  const schema = schemaSyncProviders(service, manager, engine, logs);
  const index = indexSyncProviders(service, manager, engine);
  const dependency = dependecySyncProviders(service, manager, engine);

  return [schema, index, dependency];
};
