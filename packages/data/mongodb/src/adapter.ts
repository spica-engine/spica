import {Module} from "@nestjs/common";
import {DataAdapter, PassthroughResultShaper} from "@spica-server/data";
import {DatabaseModule} from "@spica-server/database";
import {COLLECTION_QUERY, ID_TYPES, RESULT_SHAPER} from "@spica-server/interface-data";
import {MongoIdTypes} from "./id.js";
import {MongoCollectionQueryFacade} from "./query/collection-query.js";
import {MongoBucketQueryFacade} from "./bucket/query.js";
import {BUCKET_QUERY} from "@spica-server/interface-bucket-common";

export const MONGODB_ENGINE = "mongodb";

@Module({})
export class MongoDataAdapterModule {}

const providers = [
  {provide: ID_TYPES, useClass: MongoIdTypes},
  {provide: RESULT_SHAPER, useClass: PassthroughResultShaper},
  {provide: COLLECTION_QUERY, useClass: MongoCollectionQueryFacade},
  {provide: BUCKET_QUERY, useClass: MongoBucketQueryFacade}
];

const exported = [ID_TYPES, RESULT_SHAPER, COLLECTION_QUERY, BUCKET_QUERY];

export class MongoDataAdapter {
  static forRoot(...connection: Parameters<typeof DatabaseModule.withConnection>): DataAdapter {
    return {
      engine: MONGODB_ENGINE,
      module: {
        module: MongoDataAdapterModule,
        imports: [DatabaseModule.withConnection(...connection)],
        providers,
        exports: exported
      }
    };
  }

  static forExistingConnection(): DataAdapter {
    return {
      engine: MONGODB_ENGINE,
      module: {
        module: MongoDataAdapterModule,
        providers,
        exports: exported
      }
    };
  }
}
