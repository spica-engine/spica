import {Module, DynamicModule} from "@nestjs/common";
import {HistoryModule} from "@spica-server/bucket/history";
import {RealtimeModule} from "@spica-server/bucket/realtime";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {DatabaseService} from "@spica-server/database";
import {PreferenceModule} from "@spica-server/preference";
import {PreferenceService} from "@spica-server/preference/service";
import {BucketDataController} from "./bucket-data.controller";
import {BucketDataService} from "./bucket-data.service";
import {BucketController} from "./bucket.controller";
import {BucketSchemaResolver, provideBucketSchemaResolver} from "./bucket.schema.resolver";
import {CUSTOM_TYPES} from "./bucket.schema.types";
import {ServicesModule, BucketService} from "@spica-server/bucket/services";
import {BucketCache, provideBucketCache} from "./cache";
import {DocumentScheduler} from "./scheduler";
import {HookModule} from "@spica-server/bucket/hooks";
const BucketSchema = require("./schemas/bucket.schema.json");
const BucketsSchema = require("./schemas/buckets.schema.json");
const PropertyOptionsSchema = require("./schemas/property-options.schema.json");

@Module({})
export class BucketModule {
  static forRoot(options: BucketOptions): DynamicModule {
    const imports = [
      PreferenceModule,
      HistoryModule,
      RealtimeModule,
      SchemaModule.forChild({
        keywords: [CUSTOM_TYPES],
        schemas: [BucketSchema, BucketsSchema, PropertyOptionsSchema]
      }),
      ServicesModule,
      ...(options.hooks ? [HookModule] : [])
    ];

    return {
      module: BucketModule,
      controllers: [BucketController, BucketDataController],
      imports: imports,
      providers: [
        BucketDataService,
        DocumentScheduler,
        {
          provide: BucketCache,
          useFactory: provideBucketCache,
          inject: [DatabaseService, Validator]
        },
        {
          provide: BucketSchemaResolver,
          useFactory: provideBucketSchemaResolver,
          inject: [Validator, BucketService]
        }
      ],
      exports: [BucketDataService, ServicesModule]
    };
  }

  constructor(preference: PreferenceService) {
    preference.default({
      scope: "bucket",
      language: {
        available: {
          tr_TR: "Turkish",
          en_US: "English"
        },
        default: "en_US"
      }
    });
  }
}

export interface BucketOptions {
  hooks: boolean;
}
