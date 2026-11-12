import {DynamicModule} from "@nestjs/common";
import {DataCapabilities} from "@spica-server/interface-data";

export interface DataAdapter {
  engine: string;
  capabilities?: DataCapabilities;
  module: DynamicModule;
}

export {DATA_CAPABILITIES, DATA_ENGINE} from "@spica-server/interface-data";
export type {DataCapabilities} from "@spica-server/interface-data";
