import {Inject, Injectable} from "@nestjs/common";
import {
  BaseCollection,
  CreateIndexesOptions,
  DatabaseService,
  FindOneAndUpdateOptions,
  FindOptions,
  IndexSpecification
} from "@spica-server/database";
import {Function} from "@spica-server/interface/function";
import {FunctionOptions, FUNCTION_OPTIONS} from "./options";

const collectionName = "function";

@Injectable()
export class FunctionService extends BaseCollection<Function>(collectionName) {
  constructor(database: DatabaseService, @Inject(FUNCTION_OPTIONS) options: FunctionOptions) {
    super(database, {
      entryLimit: options.entryLimit,
      afterInit: () => this.createIndex({env_vars: 1})
    });
  }
}
