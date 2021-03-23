import {DynamicModule, Global, Module, Type} from "@nestjs/common";
import {HistoryModule} from "@spica-server/bucket/history";
import {HookModule} from "@spica-server/bucket/hooks";
import {RealtimeModule} from "@spica-server/bucket/realtime";
import {BucketService, ServicesModule} from "@spica-server/bucket/services";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {BUCKET_LANGUAGE_FINALIZER, PreferenceService} from "@spica-server/preference/services";
import {BucketCacheModule, BucketCacheService} from "@spica-server/bucket/cache";
import {BucketDataService} from "../services/src/bucket-data.service";
import {BucketDataController} from "./bucket-data.controller";
import {BucketController} from "./bucket.controller";
import {
  BucketSchemaResolver,
  bucketSpecificDefault,
  provideBucketSchemaResolver
} from "./bucket.schema.resolver";
import {GraphqlController} from "./graphql/graphql";
import {provideLanguageFinalizer} from "./locale";
import {registerInformers} from "./machinery";
import {DocumentScheduler} from "./scheduler";

@Module({})
export class BucketModule {
  static forRoot(options: BucketOptions): DynamicModule {
    const imports: (Type<any> | DynamicModule)[] = [
      SchemaModule.forChild({
        schemas: [
          require("./schemas/bucket.schema.json"),
          require("./schemas/buckets.schema.json")
        ],
        keywords: [bucketSpecificDefault],
        customFields: [
          // common,
          "primary",
          "options",
          // relation
          "bucketId",
          "relationType",
          "dependent",
          // location
          "locationType"
        ]
      }),
      ServicesModule
    ];

    const BucketCore = BucketCoreModule.initialize();

    if (options.cache) {
      const BucketCache = BucketCacheModule.register({ttl: options.cacheTtl || 60});
      imports.push(BucketCache);

      BucketCore.imports.push(BucketCache as any);

      BucketCore.providers.unshift(BucketCacheService as any);
      BucketCore.providers[1].inject.push(BucketCacheService as any);
    }

    imports.push(BucketCore);

    if (options.hooks) {
      imports.push(HookModule);
    }

    if (options.history) {
      imports.push(HistoryModule);
    }

    if (options.realtime) {
      imports.push(RealtimeModule);
    }

    return {
      module: BucketModule,
      controllers: [BucketController, BucketDataController],
      imports: imports,
      providers: [
        DocumentScheduler,
        {
          provide: BucketSchemaResolver,
          useFactory: provideBucketSchemaResolver,
          inject: [Validator, BucketService]
        },
        GraphqlController
      ],
      exports: [ServicesModule]
    };
  }

  constructor(preference: PreferenceService, bs: BucketService) {
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

    registerInformers(bs);
  }
}

@Global()
@Module({})
export class BucketCoreModule {
  static initialize() {
    return {
      module: BucketCoreModule,
      imports: [ServicesModule],
      providers: [
        {
          provide: BUCKET_LANGUAGE_FINALIZER,
          useFactory: provideLanguageFinalizer,
          inject: [BucketService, BucketDataService]
        }
      ],
      exports: [BUCKET_LANGUAGE_FINALIZER]
    };
  }
}

export interface BucketOptions {
  hooks: boolean;
  history: boolean;
  realtime: boolean;
  cache: boolean;
  cacheTtl?: number;
}
