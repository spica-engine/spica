import {DynamicModule, Global, Inject, Module} from "@nestjs/common";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {DATA_ENGINE, DataAdapter} from "./adapter.js";
import {bindIdTypes} from "./ids.js";

@Global()
@Module({})
export class DataModule {
  constructor(@Inject(ID_TYPES) idTypes: IdTypes) {
    bindIdTypes(idTypes);
  }

  static forRoot(adapter: DataAdapter): DynamicModule {
    return {
      module: DataModule,
      imports: [adapter.module],
      providers: [{provide: DATA_ENGINE, useValue: adapter.engine}],
      exports: [adapter.module, DATA_ENGINE]
    };
  }
}
