import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {Strategy, StrategyRepository} from "@spica-server/interface-passport";

@Injectable()
export class MongoStrategyRepository
  extends BaseCollection<Strategy>("strategy")
  implements StrategyRepository
{
  constructor(database: DatabaseService) {
    super(database);
  }

  findById(id: Id) {
    return this.findOne({_id: id});
  }

  insert(strategy: Strategy) {
    return this.insertOne(strategy);
  }

  replaceById(id: Id, strategy: Strategy) {
    return this.findOneAndReplace({_id: id}, strategy, {returnDocument: ReturnDocument.AFTER});
  }

  deleteById(id: Id) {
    return this.deleteOne({_id: id});
  }

  setOAuthRedirectUri(id: Id, redirectUri: string) {
    return this.findOneAndUpdate(
      {_id: id},
      {
        $set: {
          "options.code.params.redirect_uri": redirectUri,
          "options.access_token.params.redirect_uri": redirectUri
        }
      },
      {returnDocument: ReturnDocument.AFTER}
    );
  }
}
