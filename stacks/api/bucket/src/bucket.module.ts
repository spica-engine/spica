import {DynamicModule, Global, Inject, Module, Type} from "@nestjs/common";
import {HistoryModule} from "@spica-server/bucket/history";
import {HookModule} from "@spica-server/bucket/hooks";
import {RealtimeModule} from "@spica-server/bucket/realtime";
import {BucketService, BucketDataService, ServicesModule} from "@spica-server/bucket/services";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {BUCKET_LANGUAGE_FINALIZER, PreferenceService} from "@spica-server/preference/services";
import {BucketCacheModule} from "@spica-server/bucket/cache";
import {BucketDataController} from "./bucket-data.controller";
import {BucketController} from "./bucket.controller";
import {
  BucketSchemaResolver,
  bucketSpecificDefault,
  provideBucketSchemaResolver
} from "./bucket.schema.resolver";
import {GraphQLModule} from "@spica-server/bucket/graphql";
import {provideLanguageFinalizer} from "@spica-server/bucket/common";
import {registerInformers, returnSyncProviders} from "./machinery";
import {DocumentScheduler} from "./scheduler";
import {registerStatusProvider} from "./status";
import BucketSchema = require("./schemas/bucket.schema.json");
import BucketsSchema = require("./schemas/buckets.schema.json");
import {REGISTER_SYNC_PROVIDER} from "@spica-server/machinery";

@Module({})
export class BucketModule {
  static forRoot(options: BucketOptions): DynamicModule {
    const schemaModule = SchemaModule.forChild({
      schemas: [BucketSchema, BucketsSchema],
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
    });
    const imports: (Type<any> | DynamicModule)[] = [
      schemaModule,
      ServicesModule,
      BucketCoreModule.initialize(options)
    ];

    let BucketCache;

    if (options.cache) {
      BucketCache = BucketCacheModule.register({ttl: options.cacheTtl || 60});
      imports.push(BucketCache);
    }

    if (options.hooks) {
      imports.push(HookModule);
    }

    let History;

    if (options.history) {
      History = HistoryModule.register();
      imports.push(History);
    }

    if (options.realtime) {
      const realtime = RealtimeModule.register();

      if (options.history) {
        realtime.imports.push(History);
      }

      if (options.cache) {
        realtime.imports.push(BucketCache);
      }

      realtime.imports.push(schemaModule as any);

      imports.push(realtime);
    }

    if (options.graphql) {
      const module = GraphQLModule.forRoot();
      module.imports.push(schemaModule as any);
      imports.push(module);
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
        }
      ],
      exports: [ServicesModule]
    };
  }

  constructor(
    preference: PreferenceService,
    bs: BucketService,
    bds: BucketDataService,
    @Inject(REGISTER_SYNC_PROVIDER) obj: {manager; register}
  ) {
    const provider = returnSyncProviders(bs,obj.manager)
    obj.register(provider.reps,provider.docs)

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
    registerStatusProvider(bs, bds);
  }
}

@Global()
@Module({})
export class BucketCoreModule {
  static initialize(options: BucketOptions) {
    return {
      module: BucketCoreModule,
      imports: [ServicesModule.initialize(options.bucketDataLimit)],
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
  bucketDataLimit?: number;
  graphql: boolean;
}
