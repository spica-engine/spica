import {DynamicModule, Global, Module, Type} from "@nestjs/common";
import {HistoryModule} from "@spica-server/bucket/history";
import {HookModule} from "@spica-server/bucket/hooks";
import {RealtimeModule} from "@spica-server/bucket/realtime";
import {BucketService, ServicesModule} from "@spica-server/bucket/services";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {BUCKET_LANGUAGE_FINALIZER, PreferenceService} from "@spica-server/preference/services";
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
        keywords: [bucketSpecificDefault]
      }),
      ServicesModule
    ];

    if (options.hooks) {
      imports.push(HookModule);
    }

    if (options.history) {
      imports.push(HistoryModule);
    }

    if (options.realtime) {
      imports.push(RealtimeModule);
    }

    imports.push(BucketCoreModule);

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
@Module({
  imports: [ServicesModule],
  providers: [
    BucketDataService,
    {
      provide: BUCKET_LANGUAGE_FINALIZER,
      useFactory: provideLanguageFinalizer,
      inject: [BucketService, BucketDataService]
    }
  ],
  exports: [BUCKET_LANGUAGE_FINALIZER]
})
export class BucketCoreModule {}

export interface BucketOptions {
  hooks: boolean;
  history: boolean;
  realtime: boolean;
}
