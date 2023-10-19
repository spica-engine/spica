export * from "mongodb";

import {ObjectId as MongoObjectId} from "mongodb";
import {ObjectId as BsonObjectId} from "bson";

// bson isValid method on current mongodb version we use does not check string in 12 character length whether it's 12 byte length
// this way we update mongodb bson library only isValid method without updating the actual mongodb and its bson library
// after we upgrade mongodb, we should remove this
// related issue: https://github.com/mongodb/js-bson/pull/475
export class ObjectId extends MongoObjectId {
  static isValid(id): boolean {
    return BsonObjectId.isValid(id);
  }
}

export {DatabaseModule} from "./database.module";
export {DatabaseService} from "./database.service";
export {Document} from "./interface";
export * from "./pipes";
export * from "./collection";
