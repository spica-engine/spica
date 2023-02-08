import {Inject, Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, MongoClient} from "@spica-server/database";
import {Function} from "@spica-server/interface/function";
import {FunctionOptions, FUNCTION_OPTIONS} from "./options";

@Injectable()
export class FunctionService extends BaseCollection<Function>("function") {
  constructor(
    database: DatabaseService,
    client: MongoClient,
    @Inject(FUNCTION_OPTIONS) options: FunctionOptions
  ) {
    super(database, client, {entryLimit: options.entryLimit});
  }
}
