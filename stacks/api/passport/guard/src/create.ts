import { ModuleRef } from "@nestjs/core";
import { Type, CanActivate } from "@nestjs/common";


export function createGuard<T>(moduleRef: ModuleRef, type: Type<T>): CanActivate {
    return moduleRef.get(type);
}