import {Module, DynamicModule} from "@nestjs/common";
import {Storage} from "./storage.service";
import {StorageController} from "./storage.controller";
import {DatabaseService} from "@spica-server/database";

@Module({})
export class StorageModule {
  static forRoot(options: {path: string}): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: Storage,
          useFactory: db => new Storage(db, options.path),
          inject: [DatabaseService]
        }
      ],
      controllers: [StorageController]
    };
  }
}
