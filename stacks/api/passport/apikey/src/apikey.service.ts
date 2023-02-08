import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, MongoClient} from "@spica-server/database";
import {ApiKey} from "./interface";

@Injectable()
export class ApiKeyService extends BaseCollection<ApiKey>("apikey") {
  constructor(db: DatabaseService,client:MongoClient) {
    super(db,client);
  }
}
