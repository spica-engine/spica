import {DynamicModule, Module, Type} from "@nestjs/common";
import {BucketCache, provideBucketCache} from "./cache";
import {HistoryModule} from "@spica-server/bucket/history";
import {HookModule} from "@spica-server/bucket/hooks";
import {RealtimeModule} from "@spica-server/bucket/realtime";
import {BucketService, ServicesModule} from "@spica-server/bucket/services";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import {BucketDataController} from "./bucket-data.controller";
import {BucketDataService} from "./bucket-data.service";
import {BucketController} from "./bucket.controller";
import {BucketSchemaResolver, provideBucketSchemaResolver} from "./bucket.schema.resolver";
import {DocumentScheduler} from "./scheduler";

@Module({})
export class BucketModule {
  static forRoot(options: BucketOptions): DynamicModule {
    const imports: (Type<any> | DynamicModule)[] = [
      SchemaModule.forChild({
        schemas: [
          require("./schemas/bucket.schema.json"),
          require("./schemas/buckets.schema.json")
        ]
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

    bs.deleteMany({});

    globalThis['notify'] = async (resource, objects) => {
      const {spec, metadata} = resource;

      const raw = {...spec, properties: {...spec.properties}};

      if ( !raw.icon ) {
        raw.icon = "outbond";
      }

      for (const propertyName in spec.properties) {

        const property = {...spec.properties[propertyName]};


        if ( !raw.visible ) {
          raw.primary = propertyName; 
        }


        if ( !property.options ) {
          property.options = {
            position: 'bottom',
          };
        }

        if ( !property.title ) {
          property.title = propertyName;
        }

        raw.properties[propertyName] = property;

        if ( property.type == "relation" && typeof property.bucket == 'object' ) {
          const bucketName = property.bucket.valueFrom.resourceFieldRef.bucketName;

          const relatedBucket = objects.get(bucketName);

          raw.properties[propertyName] = {
            ...property,
            bucketId: relatedBucket.metadata.uid,
            bucket: undefined
          }
        }
      }

      if ( metadata.uid ) {

        await bs.updateOne({_id: new ObjectId(metadata.uid) }, {$set: raw});
      } else {
        const bkt = await bs.insertOne(raw);
        metadata.uid = String(bkt._id);
      }

      resource.status = "Ready";
    }

  }
}

export interface BucketOptions {
  hooks: boolean;
  history: boolean;
  realtime: boolean;
}
