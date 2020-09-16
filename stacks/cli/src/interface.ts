import { ActionParameters as __ActionParameters__ } from "@caporal/core";
import { Logger } from "./logger";

export interface ActionParameters extends Omit<__ActionParameters__, "logger"> {
  logger: Logger
}
