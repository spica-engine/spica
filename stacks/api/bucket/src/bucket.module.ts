import {DynamicModule, Global, Inject, Module, Optional, Type} from "@nestjs/common";
import {HistoryModule, HistoryService} from "@spica-server/bucket/history";
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
import {registerInformers} from "./machinery";
import {DocumentScheduler} from "./scheduler";
import {registerStatusProvider} from "./status";
import BucketSchema = require("./schemas/bucket.schema.json");
import BucketsSchema = require("./schemas/buckets.schema.json");
import {
  RegisterSyncProvider,
  REGISTER_VC_SYNC_PROVIDER,
  VC_REP_MANAGER
} from "@spica-server/versioncontrol";
import {getSyncProvider} from "./versioncontrol/schema";
import {registerAssetHandlers} from "./asset";
import {IRepresentativeManager} from "@spica-server/interface/representative";

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
    validator: Validator,
    @Optional() private history: HistoryService,
    @Optional() @Inject(VC_REP_MANAGER) private repManager: IRepresentativeManager,
    @Optional() @Inject(REGISTER_VC_SYNC_PROVIDER) registerSync: RegisterSyncProvider
  ) {
    if (registerSync) {
      const provider = getSyncProvider(bs, bds, this.history, this.repManager);
      registerSync(provider);
    }

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
    registerAssetHandlers(bs, bds, history, validator);
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
