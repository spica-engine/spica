import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "../engine";
import {LogService} from "@spica-server/function/log";
import {getIndexSynchronizer} from "./fnindex";
import {getSchemaSynchronizer} from "./schema";
import {getDependencySynchronizer} from "./dependency";

export const getSynchronizers = (
  service: FunctionService,
  engine: FunctionEngine,
  logs: LogService
) => {
  const schema = getSchemaSynchronizer(service, engine, logs);
  const index = getIndexSynchronizer(service, engine);
  const dependency = getDependencySynchronizer(service, engine);

  return [schema, index, dependency];
};
