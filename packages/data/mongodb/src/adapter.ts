import {Module} from "@nestjs/common";
import {DataAdapter} from "@spica-server/data";
import {DatabaseModule} from "@spica-server/database";
import {ID_TYPES} from "@spica-server/interface-data";
import {MongoIdTypes} from "./id.js";

export const MONGODB_ENGINE = "mongodb";

@Module({})
export class MongoDataAdapterModule {}

const providers = [{provide: ID_TYPES, useClass: MongoIdTypes}];

export class MongoDataAdapter {
  static forRoot(...connection: Parameters<typeof DatabaseModule.withConnection>): DataAdapter {
    return {
      engine: MONGODB_ENGINE,
      module: {
        module: MongoDataAdapterModule,
        imports: [DatabaseModule.withConnection(...connection)],
        providers,
        exports: [ID_TYPES]
      }
    };
  }

  static forExistingConnection(): DataAdapter {
    return {
      engine: MONGODB_ENGINE,
      module: {
        module: MongoDataAdapterModule,
        providers,
        exports: [ID_TYPES]
      }
    };
  }
}
