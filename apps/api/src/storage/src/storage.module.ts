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

import BsonObject from "./schema/bson.object.schema.json" with {type: "json"};
import JsonObject from "./schema/json.object.schema.json" with {type: "json"};
import MultipartObject from "./schema/multipart.object.schema.json" with {type: "json"};

import BodySchema from "./schema/body.schema.json" with {type: "json"};
import BodySingleSchema from "./schema/body.single.schema.json" with {type: "json"};

import {AWSS3} from "./strategy/aws.s3";

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
          schemas: [MultipartObject, BsonObject, JsonObject, BodySchema, BodySingleSchema],
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
              case "awss3":
                return new AWSS3(options.awss3CredentialsPath, options.awss3BucketName);
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
