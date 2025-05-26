import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "../engine";
import {LogService} from "@spica-server/function/log";
import {getIndexSynchronizer} from "./fnindex";
import {getSchemaSynchronizer} from "./schema";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {getDependencySynchronizer} from "./dependency";

export const getSynchronizers = (
  service: FunctionService,
  manager: IRepresentativeManager,
  engine: FunctionEngine,
  logs: LogService
) => {
  const schema = getSchemaSynchronizer(service, manager, engine, logs);
  const index = getIndexSynchronizer(service, manager, engine);
  const dependency = getDependencySynchronizer(service, manager, engine);

  return [schema, index, dependency];
};
