import {DynamicModule, Global, Inject, Module, Optional, Type} from "@nestjs/common";
import {HistoryModule} from "@spica-server/bucket-history";
import {HISTORY_REPOSITORY, HistoryRepository} from "@spica-server/interface-bucket-history";
import {HookModule} from "@spica-server/bucket-hooks";
import {RealtimeModule} from "@spica-server/bucket-realtime";
import {SchemasRealtimeModule} from "@spica-server/bucket-schemas-realtime";
import {BucketService, ServicesModule} from "@spica-server/bucket-services";
import {
  BUCKET_DATA_REPOSITORY,
  BUCKET_REPOSITORY,
  BUCKET_SCHEMA_EXTENSION,
  BucketDataRepository,
  BucketRepository,
  BucketSchemaExtension
} from "@spica-server/interface-bucket";
import {SchemaModule, Validator} from "@spica-server/core-schema";
import {createHashFormat, createEncryptedFormat, UUID} from "@spica-server/core-schema";
import {PreferenceService} from "@spica-server/preference-services";
import {BUCKET_LANGUAGE_FINALIZER} from "@spica-server/interface-preference";
import {BucketCacheModule} from "@spica-server/bucket-cache";
import {BucketDataController} from "./bucket-data.controller.js";
import {BucketController} from "./bucket.controller.js";
import {
  BucketSchemaResolver,
  bucketSpecificDefault,
  provideBucketSchemaResolver
} from "./bucket.schema.resolver.js";
import {GraphQLModule} from "@spica-server/bucket-graphql";
import {composeBucketSchema, provideLanguageFinalizer} from "@spica-server/bucket-common";
import {registerStatusProvider} from "./status.js";
import BucketSchema from "./schemas/bucket.schema.json" with {type: "json"};
import BucketsSchema from "./schemas/buckets.schema.json" with {type: "json"};
import {registerAssetHandlers} from "./asset.js";
import {IRepresentativeManager} from "@spica-server/interface-representative";
import {ASSET_REP_MANAGER} from "@spica-server/interface-asset";
import {BucketOptions} from "@spica-server/interface-bucket";

const BUCKET_DEFINITION_SCHEMA = Symbol.for("BUCKET_DEFINITION_SCHEMA");

function provideBucketDefinitionSchema(validator: Validator, extension: BucketSchemaExtension) {
  extension.keywords?.forEach(keyword => validator.registerKeyword(keyword));
  const schema = composeBucketSchema(BucketSchema, extension.schema);
  validator.registerSchema(schema as {$id: string});
  return schema;
}

@Module({})
export class BucketModule {
  static forRoot(options: BucketOptions): DynamicModule {
    const formats = [
      UUID,
      ...(options.hashSecret ? [createHashFormat(options.hashSecret)] : []),
      ...(options.hashSecret && options.encryptionSecret
        ? [createEncryptedFormat(options.encryptionSecret, options.hashSecret)]
        : [])
    ];

    const schemaModule = SchemaModule.forChild({
      schemas: [BucketsSchema],
      formats,
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
      imports.push(SchemasRealtimeModule.register());
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
        },
        {
          provide: BUCKET_DEFINITION_SCHEMA,
          useFactory: provideBucketDefinitionSchema,
          inject: [Validator, BUCKET_SCHEMA_EXTENSION]
        }
      ],
      exports: [ServicesModule]
    };
  }

  constructor(
    preference: PreferenceService,
    bs: BucketService,
    @Inject(BUCKET_REPOSITORY) buckets: BucketRepository,
    @Inject(BUCKET_DATA_REPOSITORY) bucketData: BucketDataRepository,
    validator: Validator,
    @Optional() @Inject(HISTORY_REPOSITORY) private history: HistoryRepository,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager
  ) {
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

    registerStatusProvider(bs, buckets, bucketData);
    registerAssetHandlers(bs, bucketData, history, validator, this.assetRepManager);
  }
}

@Global()
@Module({})
export class BucketCoreModule {
  static initialize(options: BucketOptions) {
    return {
      module: BucketCoreModule,
      imports: [
        ServicesModule.initialize(
          options.bucketDataLimit,
          options.hashSecret,
          options.encryptionSecret
        )
      ],
      providers: [
        {
          provide: BUCKET_LANGUAGE_FINALIZER,
          useFactory: provideLanguageFinalizer,
          inject: [BUCKET_REPOSITORY, BUCKET_DATA_REPOSITORY]
        }
      ],
      exports: [BUCKET_LANGUAGE_FINALIZER]
    };
  }
}
