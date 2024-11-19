import {DynamicModule, Global, Module} from "@nestjs/common";
import {GLOBAL_SCHEMA_MODULE_OPTIONS, ModuleOptions, SCHEMA_MODULE_OPTIONS} from "./interface";
import {Validator} from "./validator";

@Global()
@Module({})
class CoreSchemaModule {
  static initialize(options: ModuleOptions): DynamicModule {
    return {
      module: CoreSchemaModule,
      providers: [{provide: GLOBAL_SCHEMA_MODULE_OPTIONS, useValue: options}],
      exports: [GLOBAL_SCHEMA_MODULE_OPTIONS]
    };
  }
}

@Module({})
export class SchemaModule {
  static forChild(options: ModuleOptions = {}): DynamicModule {
    return {
      module: SchemaModule,
      providers: [{provide: SCHEMA_MODULE_OPTIONS, useValue: options}, Validator],
      exports: [Validator]
    };
  }

  static forRoot(options: ModuleOptions = {}): DynamicModule {
    return {
      module: SchemaModule,
      imports: [CoreSchemaModule.initialize(options)],
      exports: [CoreSchemaModule]
    };
  }
}
