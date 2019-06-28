import { DynamicModule, Module } from '@nestjs/common';
import { LOCAL_SCHEMAS, ModuleOptions, SCHEMA_DEFAULT, SCHEMA_FORMAT, SCHEMA_KEYWORD } from './interface';
import { Validator } from './validator';

@Module({})
export class SchemaModule {
  static forChild({ defaults = [], formats = [], schemas = [], keywords = [] }: ModuleOptions = {}): DynamicModule {
    return {
      module: SchemaModule,
      providers: [
        { provide: SCHEMA_DEFAULT, useValue: defaults }, 
        { provide: LOCAL_SCHEMAS, useValue: schemas },
        { provide: SCHEMA_FORMAT, useValue: formats }, 
        { provide: SCHEMA_KEYWORD, useValue: keywords }, 
        
        Validator
      ],
      exports: [Validator]
    };
  }
}
