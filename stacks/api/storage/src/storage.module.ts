import {DynamicModule, Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {StorageOptions, STORAGE_OPTIONS} from "./options";
import {StorageController} from "./storage.controller";
import {StorageService} from "./storage.service";
import {Default} from "./strategy/default";
import {GCloud} from "./strategy/gcloud";
import {Strategy} from "./strategy/strategy";
import {BASE_64} from "./schema/format";
import {registerStatusProvider} from "./status";

@Module({})
export class StorageModule {
  constructor(storageService: StorageService) {
    registerStatusProvider(storageService);
  }

  static forRoot(options: StorageOptions): DynamicModule {
    return {
      module: StorageModule,
      imports: [
        SchemaModule.forChild({
          schemas: [
            require("./schema/bson.object.schema.json"),
            require("./schema/json.object.schema.json"),
            require("./schema/body.schema.json"),
            require("./schema/body.single.schema.json")
          ],
          formats: [BASE_64]
        })
      ],
      providers: [
        {
          provide: STORAGE_OPTIONS,
          useValue: options
        },
        StorageService,
        {
          provide: Strategy,
          useFactory: (options: StorageOptions) => {
            switch (options.strategy) {
              case "gcloud":
                return new GCloud(options.gcloudServiceAccountPath, options.gcloudBucketName);
              case "default":
                return new Default(options.defaultPath, options.defaultPublicUrl);
              default:
                throw new Error(`Unknown strategy ${options.strategy}`);
            }
          },
          inject: [STORAGE_OPTIONS]
        }
      ],
      controllers: [StorageController]
    };
  }
}
