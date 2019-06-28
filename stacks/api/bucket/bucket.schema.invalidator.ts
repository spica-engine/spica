import {OnModuleInit, OnModuleDestroy} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {DatabaseService, ChangeStream} from "@spica-server/database";

export class SchemaCacheInvalidator implements OnModuleInit, OnModuleDestroy {
  stream: ChangeStream;

  constructor(private validator: Validator, private db: DatabaseService) {}

  onModuleInit() {
    // TODO(thesayyn): Also, invalidate when new language added.
    this.stream = this.db.collection("buckets").watch();
    this.stream.on("change", change => {
      this.validator.removeSchema(`bucket:${change.documentKey._id}`);
    });
  }

  onModuleDestroy() {
    this.stream.close();
  }
}
