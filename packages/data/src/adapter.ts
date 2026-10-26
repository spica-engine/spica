import {DynamicModule} from "@nestjs/common";

export interface DataAdapter {
  engine: string;
  module: DynamicModule;
}

export const DATA_ENGINE = Symbol.for("SPICA_DATA_ENGINE");
