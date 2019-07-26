import {Injectable} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {ChangeStream, DatabaseService} from "@spica-server/database";

@Injectable()
export class BucketCache {
  private stream: ChangeStream;
  constructor(private db: DatabaseService, validator: Validator) {
    this.stream = this.db.collection("buckets").watch();
    this.stream.on("change", changes =>
      validator.removeSchema(changes.documentKey._id.toHexString())
    );
  }

  onModuleDestroy() {
    this.stream.close();
  }
}

export function provideBucketCache(database: DatabaseService, validator: Validator) {
  return new BucketCache(database, validator);
}
