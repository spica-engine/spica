import {DynamicModule, Global, Module, Type} from "@nestjs/common";
import {HistoryModule, HistoryService} from "@spica-server/bucket/history";
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
import {provideLanguageFinalizer} from "@spica-server/bucket/common";
import {registerInformers} from "./machinery";
import {DocumentScheduler} from "./scheduler";
import {registerStatusProvider} from "./status";

@Module({})
export class BucketModule {
  static forRoot(options: BucketOptions): DynamicModule {
    const schemaModule = SchemaModule.forChild({
      schemas: [require("./schemas/bucket.schema.json"), require("./schemas/buckets.schema.json")],
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
    const imports: (Type<any> | DynamicModule)[] = [schemaModule, ServicesModule];

    const BucketCore = BucketCoreModule.initialize();

    let BucketCache;

    if (options.cache) {
      BucketCache = BucketCacheModule.register({ttl: options.cacheTtl || 60});
      imports.push(BucketCache);

      BucketCore.imports.push(BucketCache as any);

      BucketCore.providers.unshift(BucketCacheService as any);
      BucketCore.providers[1].inject.push(BucketCacheService as any);
    }

    imports.push(BucketCore);

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
      const gateway = realtime.providers.shift();

      const gatewayWithDependents = {
        provide: gateway,
        useClass: gateway,
        inject: [Validator]
      };

      if (options.history) {
        realtime.imports.push(History);
        gatewayWithDependents.inject.push(HistoryService as any);
      }

      if (options.cache) {
        realtime.imports.push(BucketCache);
        gatewayWithDependents.inject.push(BucketCacheService as any);
      }

      realtime.providers.unshift(gatewayWithDependents as any);

      realtime.imports.push(schemaModule as any);

      imports.push(realtime);
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

  constructor(preference: PreferenceService, bs: BucketService, bds: BucketDataService) {
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
    registerStatusProvider(bs,bds);
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
