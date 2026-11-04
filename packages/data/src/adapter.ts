import {DynamicModule} from "@nestjs/common";

export interface DataAdapter {
  engine: string;
  module: DynamicModule;
}

export {DATA_ENGINE} from "@spica-server/interface-data";
