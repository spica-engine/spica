import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {BaseConfig, ConfigRepository} from "@spica-server/interface-config";

@Injectable()
export class MongoConfigRepository
  extends BaseCollection<BaseConfig>("config")
  implements ConfigRepository
{
  constructor(db: DatabaseService) {
    super(db);
  }

  findByModule(module: string) {
    return this.findOne({module});
  }

  replaceByModule(module: string, config: BaseConfig) {
    return this.findOneAndReplace({module}, config, {
      returnDocument: ReturnDocument.AFTER,
      upsert: true
    });
  }

  async setOptions(module: string, options: object) {
    await this.updateOne({module}, {$set: {module, options}}, {upsert: true});
  }

  async setOption(module: string, name: string, value: unknown) {
    await this.updateOne({module}, {$set: {[`options.${name}`]: value}}, {upsert: true});
  }
}
