import {DynamicModule, Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core-schema";
import {StorageOptions, STORAGE_OPTIONS} from "@spica-server/interface/storage";
import {StorageController} from "./storage.controller.js";
import {StorageService} from "./storage.service.js";
import {Default} from "./strategy/default.js";
import {GCloud} from "./strategy/gcloud.js";
import {Strategy} from "./strategy/strategy.js";
import {BASE_64} from "./schema/format/index.js";
import {registerStatusProvider} from "./status.js";

import BsonObject from "./schema/bson.object.schema.json" with {type: "json"};
import JsonObject from "./schema/json.object.schema.json" with {type: "json"};
import MultipartObject from "./schema/multipart.object.schema.json" with {type: "json"};

import BodySchema from "./schema/body.schema.json" with {type: "json"};
import BodySingleSchema from "./schema/body.single.schema.json" with {type: "json"};

import {AWSS3} from "./strategy/aws.s3.js";

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
                return new AWSS3(
                  options.awss3CredentialsPath,
                  options.awss3BucketName,
                  options.resumableUploadExpiresIn
                );
              case "gcloud":
                return new GCloud(
                  options.gcloudServiceAccountPath,
                  options.gcloudBucketName,
                  options.resumableUploadExpiresIn
                );
              case "default":
                return new Default(
                  options.defaultPath,
                  options.defaultPublicUrl,
                  options.resumableUploadExpiresIn
                );
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
