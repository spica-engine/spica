import {DynamicModule, Module} from "@nestjs/common";
import {StorageOptions, STORAGE_OPTIONS} from "./options";
import {StorageController} from "./storage.controller";
import {Storage} from "./storage.service";
import {Service, factoryProvider} from "./service";

@Module({})
export class StorageModule {
  static forRoot(options: StorageOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: STORAGE_OPTIONS,
          useValue: options
        },
        Storage,
        {
          provide: Service,
          useFactory: factoryProvider,
          inject: [STORAGE_OPTIONS]
        }
      ],
      controllers: [StorageController]
    };
  }
}
