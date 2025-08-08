import {FunctionService} from "../../services";
import {FunctionEngine} from "../engine";
import {LogService} from "../../log";
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
  const dependency = getDependencySynchronizer(engine);

  return [schema, index, dependency];
};
