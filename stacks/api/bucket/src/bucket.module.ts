import {DynamicModule, Global, Module, Type} from "@nestjs/common";
import {HistoryModule} from "@spica-server/bucket/history";
import {HookModule} from "@spica-server/bucket/hooks";
import {RealtimeModule} from "@spica-server/bucket/realtime";
import {Bucket, BucketService, ServicesModule} from "@spica-server/bucket/services";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {ObjectId} from "@spica-server/database";
import {register, store, Store} from "@spica-server/machinery";
import {PreferenceService, PREFERENCE_CHANGE_FINALIZER} from "@spica-server/preference/services";
import {BucketDataController} from "./bucket-data.controller";
import {BucketDataService} from "./bucket-data.service";
import {BucketController} from "./bucket.controller";
import {BucketSchemaResolver, provideBucketSchemaResolver} from "./bucket.schema.resolver";
import {DocumentScheduler} from "./scheduler";
import {provideLanguageChangeUpdater} from "./utility";

async function v1_schema_to_internal(obj): Promise<Bucket> {
  const {spec} = obj;
  const store = new Store({group: "bucket", resource: "schemas"});

  const raw = {...spec, properties: {...spec.properties}};

  if (!raw.icon) {
    raw.icon = "outbond";
  }

  for (const propertyName in spec.properties) {
    const property = {...spec.properties[propertyName]};

    if (!raw.visible) {
      raw.primary = propertyName;
    }

    if (!property.options) {
      property.options = {
        position: "bottom"
      };
    }

    if (!property.title) {
      property.title = propertyName;
    }

    raw.properties[propertyName] = property;

    if (property.type == "relation" && typeof property.bucket == "object") {
      const bucketName = property.bucket.valueFrom.resourceFieldRef.bucketName;

      const relatedBucket = await store.get(bucketName);

      raw.properties[propertyName] = {
        ...property,
        bucketId: relatedBucket.metadata.uid,
        bucket: undefined
      };
    }
  }

  return raw;
}

@Module({})
export class BucketModule {
  static forRoot(options: BucketOptions): DynamicModule {
    const imports: (Type<any> | DynamicModule)[] = [
      SchemaModule.forChild({
        schemas: [require("./schemas/bucket.schema.json"), require("./schemas/buckets.schema.json")]
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
        BucketDataService,
        DocumentScheduler,
        {
          provide: BucketSchemaResolver,
          useFactory: provideBucketSchemaResolver,
          inject: [Validator, BucketService]
        }
      ],
      exports: [BucketDataService, ServicesModule]
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

    register(
      {
        group: "bucket",
        resource: "schemas",
        version: "v1"
      },
      {
        add: async (obj: any) => {
          const bucketSchemaInternal = await v1_schema_to_internal(obj);
          const bkt = await bs.insertOne(bucketSchemaInternal);
          const st = store({
            group: "bucket",
            resource: "schemas",
          });
          await st.patch(obj.metadata.name, {metadata: {uid: String(bkt._id)}, status: 'Ready'});
        },
        update: async (_, newObj: any) => {
          const bucketSchemaInternal = await v1_schema_to_internal(newObj);
          await bs.updateOne(
            {_id: new ObjectId(newObj.metadata.uid)},
            {$set: bucketSchemaInternal}
          );
        },
        delete: async obj => {
          await bs.deleteOne({_id: new ObjectId(obj.metadata.uid)});
        }
      }
    );
  }
}

@Global()
@Module({
  imports: [ServicesModule],
  providers: [
    BucketDataService,
    {
      provide: PREFERENCE_CHANGE_FINALIZER,
      useFactory: provideLanguageChangeUpdater,
      inject: [BucketService, BucketDataService]
    }
  ],
  exports: [PREFERENCE_CHANGE_FINALIZER]
})
export class BucketCoreModule {}

export interface BucketOptions {
  hooks: boolean;
  history: boolean;
  realtime: boolean;
}
