import {Module} from "@nestjs/common";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {Module as FnModule} from "./base";

@FnModule({moduleSpecifier: "@internal/database"})
export class DatabaseUnit implements FnModule {
  constructor(private db: DatabaseService) {}

  create(): {[key: string]: object} {
    return {
      database: () => {
        return {
          collection: (name: string) => {
            const collection = this.db.collection(name);
            return collection;
          }
        };
      },
      objectId: (id?: string | number | ObjectId) => new ObjectId(id)
    };
  }
}

@Module({
  providers: [DatabaseUnit],
  exports: [DatabaseUnit]
})
export class DatabaseUnitModule {}
