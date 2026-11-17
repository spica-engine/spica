import {Injectable} from "@nestjs/common";
import {DatabaseService} from "@spica-server/database";
import {DataHealth} from "@spica-server/interface-data";

@Injectable()
export class MongoDataHealth implements DataHealth {
  constructor(private readonly db: DatabaseService) {}

  async ping() {
    await this.db.command({ping: 1});
  }
}
