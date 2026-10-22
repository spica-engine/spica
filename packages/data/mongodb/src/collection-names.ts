import {Injectable} from "@nestjs/common";
import {DatabaseService} from "@spica-server/database";
import {CollectionNames} from "@spica-server/interface-data";

@Injectable()
export class MongoCollectionNames implements CollectionNames {
  constructor(private readonly db: DatabaseService) {}

  list() {
    return this.db
      .collections()
      .then(collections => collections.map(collection => collection.collectionName));
  }
}
