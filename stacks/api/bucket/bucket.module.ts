import {Module} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {DatabaseService} from "@spica-server/database";
import {PreferenceModule, PreferenceService} from "@spica-server/preference";
import {BucketDataController} from "./bucket-data.controller";
import {BucketDataService} from "./bucket-data.service";
import {BucketController} from "./bucket.controller";
import {BUCKET_ID, CREATED_AT, CUSTOM_TYPES, UPDATED_AT} from "./bucket.schema.defaults";
import {SchemaCacheInvalidator} from "./bucket.schema.invalidator";
import {BucketSchemaResolver, provideBucketSchemaResolver} from "./bucket.schema.resolver";
import {BucketService} from "./bucket.service";
import {HistoryModule} from "./history/history.module";
const BucketSchema = require("./schemas/bucket.schema.json");
const PropertyOptionsSchema = require("./schemas/property-options.schema.json");

@Module({
  controllers: [BucketController, BucketDataController],
  imports: [
    PreferenceModule,
    HistoryModule,
    SchemaModule.forChild({
      keywords: [CUSTOM_TYPES],
      defaults: [CREATED_AT, UPDATED_AT],
      formats: [BUCKET_ID],
      schemas: [BucketSchema, PropertyOptionsSchema]
    })
  ],
  providers: [
    BucketService,
    BucketDataService,
    {
      provide: BucketSchemaResolver,
      useFactory: provideBucketSchemaResolver,
      inject: [Validator, BucketService]
    },
    {
      provide: SchemaCacheInvalidator,
      useFactory: (validator, db) => new SchemaCacheInvalidator(validator, db),
      inject: [Validator, DatabaseService]
    }
  ],
  exports: [BucketDataService]
})
export class BucketModule {
  constructor(preference: PreferenceService) {
    preference.default({
      scope: "bucket",
      language: {
        supported_languages: [{code: "en_US", name: "English"}, {code: "tr_TR", name: "Turkish"}],
        default: {code: "en_US", name: "English"}
      }
    });
  }
}
