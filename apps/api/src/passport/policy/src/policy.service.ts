import {Injectable} from "@nestjs/common";
import {Collection, DatabaseService, ObjectId, BaseCollection} from "@spica-server/database";
import {Policy} from "@spica-server/interface/passport/policy";
import managedPolicies from "./policies";

@Injectable()
export class PolicyService extends BaseCollection<Policy>("policies") {
  managedPolicies: Array<PolicyWithType>;
  customerManagedPolicies: Array<PolicyWithType>;

  get policies(): Array<PolicyWithType> {
    return [...this.managedPolicies, ...this.customerManagedPolicies];
  }

  constructor(db: DatabaseService) {
    super(db);
    this.managedPolicies = managedPolicies.map(p => ({...p, system: true}) as PolicyWithType);
  }

  _findAll(): Promise<Policy[]> {
    return this._coll
      .find()
      .toArray()
      .then(policies => {
        this.customerManagedPolicies = policies.map(p => {
          const policy = {...p, system: false};
          return policy as PolicyWithType;
        });
        return this.policies;
      });
  }

  paginate(filter: object, limit: number, skip: number = 0) {
    const policies = this.policies.filter(policy => {
      let isMatched = true;

      for (const [key, value] of Object.entries(filter)) {
        if (policy[key] != value) {
          isMatched = false;
          break;
        }
      }

      return isMatched;
    });

    return {
      meta: {
        total: policies.length
      },
      data: policies.slice(skip || 0, (skip || 0) + (limit || policies.length))
    };
  }
  async upsertOne(filter: Partial<Policy>, doc: Policy): Promise<number> {
    const result = await this._coll.updateOne(filter, {$set: doc}, {upsert: true});
    return result.upsertedCount || result.modifiedCount;
  }
}

type PolicyWithType = Policy & {system: boolean};
