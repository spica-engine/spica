import {Module} from "@nestjs/common";
import {DataAdapter, PassthroughResultShaper} from "@spica-server/data";
import {DatabaseModule} from "@spica-server/database";
import {
  CHANGE_FEED,
  COLLECTION_NAMES,
  COLLECTION_QUERY,
  DATA_HEALTH,
  ID_TYPES,
  REPOSITORY_CLASSES,
  RESULT_SHAPER
} from "@spica-server/interface-data";
import {repositoryClasses} from "./repositories/index.js";
import {MongoCollectionNames} from "./collection-names.js";
import {MongoDataHealth} from "./health.js";
import {MongoChangeFeed} from "./change-feed.js";
import {MongoIdTypes} from "./id.js";
import {MongoCollectionQueryFacade} from "./query/collection-query.js";
import {MongoBucketQueryFacade} from "./bucket/query.js";
import {MongoBucketWriteFacade} from "./bucket/write.js";
import {BUCKET_QUERY, BUCKET_WRITE} from "@spica-server/interface-bucket-common";
import {BUCKET_SCHEMA_EXTENSION} from "@spica-server/interface-bucket";
import {mongoBucketSchema} from "./schemas/index.js";

export const MONGODB_ENGINE = "mongodb";

@Module({})
export class MongoDataAdapterModule {}

const providers = [
  {provide: ID_TYPES, useClass: MongoIdTypes},
  {provide: RESULT_SHAPER, useClass: PassthroughResultShaper},
  {provide: COLLECTION_QUERY, useClass: MongoCollectionQueryFacade},
  {provide: BUCKET_QUERY, useClass: MongoBucketQueryFacade},
  {provide: BUCKET_WRITE, useClass: MongoBucketWriteFacade},
  {provide: BUCKET_SCHEMA_EXTENSION, useValue: mongoBucketSchema},
  {provide: REPOSITORY_CLASSES, useValue: repositoryClasses},
  {provide: COLLECTION_NAMES, useClass: MongoCollectionNames},
  {provide: DATA_HEALTH, useClass: MongoDataHealth},
  {provide: CHANGE_FEED, useClass: MongoChangeFeed}
];

const exported = [
  ID_TYPES,
  RESULT_SHAPER,
  COLLECTION_QUERY,
  BUCKET_QUERY,
  BUCKET_WRITE,
  BUCKET_SCHEMA_EXTENSION,
  REPOSITORY_CLASSES,
  COLLECTION_NAMES,
  DATA_HEALTH,
  CHANGE_FEED
];

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
