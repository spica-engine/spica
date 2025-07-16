import {DynamicModule, Global, Inject, Module, Optional, Type} from "@nestjs/common";
import {HistoryModule, HistoryService} from "@spica-server/bucket/history";
import {HookModule} from "@spica-server/bucket/hooks";
import {RealtimeModule} from "@spica-server/bucket/realtime";
import {SchemasRealtimeModule} from "@spica-server/bucket/schemas-realtime";
import {BucketService, BucketDataService, ServicesModule} from "@spica-server/bucket/services";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {PreferenceService} from "@spica-server/preference/services";
import {BUCKET_LANGUAGE_FINALIZER} from "@spica-server/interface/preference";
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
import {registerStatusProvider} from "./status";
import BucketSchema from "./schemas/bucket.schema.json" with {type: "json"};
import BucketsSchema from "./schemas/buckets.schema.json" with {type: "json"};
import {
  REGISTER_VC_SYNCHRONIZER,
  RegisterVCSynchronizer
} from "@spica-server/interface/versioncontrol";
import {registerAssetHandlers} from "./asset";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {ASSET_REP_MANAGER} from "@spica-server/interface/asset";
import {Bucket, BucketOptions} from "@spica-server/interface/bucket";
import {getSynchronizer} from "./versioncontrol/synchronizer";

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
        "locationType",
        "acl"
      ]
    });
    const imports: (Type<any> | DynamicModule)[] = [
      schemaModule,
      ServicesModule,
      BucketCoreModule.initialize(options),
      SchemasRealtimeModule.register()
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
    @Optional()
    @Inject(REGISTER_VC_SYNCHRONIZER)
    registerVCSynchronizer: RegisterVCSynchronizer<Bucket>,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager
  ) {
    if (registerVCSynchronizer) {
      const synchronizer = getSynchronizer(bs, bds, this.history);
      registerVCSynchronizer(synchronizer);
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

    registerStatusProvider(bs, bds);
    registerAssetHandlers(bs, bds, history, validator, this.assetRepManager);
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
