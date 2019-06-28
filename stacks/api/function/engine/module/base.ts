import {Injectable, SetMetadata} from "@nestjs/common";

export const MODULE_METADATA = "functionModule";

export interface ModuleMetadata {
  moduleSpecifier: string;
}

export function Module(options: ModuleMetadata): ClassDecorator {
  return target => {
    SetMetadata(MODULE_METADATA, options)(target);
    Injectable()(target);
  };
}

export interface Module {
  create(): {
    [key: string]: object;
  };
}
