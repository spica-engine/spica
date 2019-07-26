import {Module} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {DatabaseService} from "@spica-server/database";
import {PreferenceModule, PreferenceService} from "@spica-server/preference";
import {BucketDataController} from "./bucket-data.controller";
import {BucketDataService} from "./bucket-data.service";
import {BucketController} from "./bucket.controller";
import {BucketSchemaResolver, provideBucketSchemaResolver} from "./bucket.schema.resolver";
import {CUSTOM_TYPES} from "./bucket.schema.types";
import {BucketService} from "./bucket.service";
import {BucketCache, provideBucketCache} from "./cache";
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
      schemas: [BucketSchema, PropertyOptionsSchema]
    })
  ],
  providers: [
    BucketService,
    BucketDataService,
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
