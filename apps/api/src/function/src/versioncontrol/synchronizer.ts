import {FunctionService} from "@spica-server/function/services";
import {SyncProvider} from "@spica-server/interface/versioncontrol";
import {FunctionEngine} from "../engine";
import {LogService} from "@spica-server/function/log";
import {dependecySyncProviders} from "./dependency";
import {indexSyncProviders} from "./fnindex";
import {getSchemaSynchronizer} from "./schema";
import {Dependency} from "@spica-server/interface/function";
import {IRepresentativeManager} from "@spica-server/interface/representative";

export const getSynchronizers = (
  service: FunctionService,
  manager: IRepresentativeManager,
  engine: FunctionEngine,
  logs: LogService
) => {
  const schema = getSchemaSynchronizer(service, manager, engine, logs);
  //   const index = getIndexSynchronizer();
  //   const dependency = getDependencySynchronizer();

  return [schema];
};
