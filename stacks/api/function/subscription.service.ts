import {
  Collection,
  DatabaseService,
  ObjectId,
  DeleteWriteOpResultObject
} from "@spica-server/database";
import {Injectable} from "@nestjs/common";
import {Subscription, SubscriptionEngine} from "./engine";

@Injectable()
export class SubscriptionService {
  private collection: Collection<Subscription>;
  constructor(db: DatabaseService, private engine: SubscriptionEngine) {
    this.collection = db.collection("subscription");
  }

  findOne(subscriptonId: ObjectId) {
    return this.collection.findOne({_id: new ObjectId(subscriptonId)});
  }

  find(aggregation?: any) {
    return this.collection.aggregate<any>(aggregation).toArray();
  }

  upsertOne(subscription: Subscription) {
    const body = {...subscription};
    delete body._id;
    return this.collection
      .replaceOne({_id: new ObjectId(subscription._id)}, body, {
        upsert: true
      })
      .then(r => {
        if (subscription._id) {
          this.engine.refuse(subscription);
        }

        subscription._id = subscription._id || r.upsertedId._id.toHexString();
        this.engine.introduce(subscription);
        return subscription;
      });
  }

  deleteOne(subscriptonId: ObjectId): Promise<DeleteWriteOpResultObject> {
    return this.findOne(subscriptonId)
      .then(subs => this.engine.refuse(subs))
      .then(() => this.collection.deleteOne({_id: subscriptonId}));
  }
}
