import {Injectable} from "@nestjs/common";
import {
  Collection,
  DatabaseService,
  ObjectId,
  InsertOneWriteOpResult,
  FilterQuery,
  FindOneAndReplaceOption,
  BaseCollection
} from "@spica/database";
import {Policy} from "./interface";
import managedPolicies from "./policies";

@Injectable()
export class PolicyService extends BaseCollection("policies") {
  managedPolicies: Array<PolicyWithType>;
  customerManagedPolicies: Array<PolicyWithType>;

  get policies(): Array<PolicyWithType> {
    return [...this.managedPolicies, ...this.customerManagedPolicies];
  }

  constructor(db: DatabaseService) {
    super(db);
    this.managedPolicies = managedPolicies.map(p => ({...p, system: true} as PolicyWithType));
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
}

type PolicyWithType = Policy & {system: boolean};
type UserManagedPolicy = Policy & {_id?: string};
