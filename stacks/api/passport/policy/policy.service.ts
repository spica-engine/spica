import {Injectable} from "@nestjs/common";
import {
  Collection,
  DatabaseService,
  ObjectId,
  InsertOneWriteOpResult
} from "@spica-server/database";
import {Policy, Service} from "./interface";

@Injectable()
export class PolicyService {
  private _policyCollection: Collection<UserManagedPolicy>;

  managedPolicies: Array<PolicyWithType>;
  customerManagedPolicies: Array<PolicyWithType>;

  get policies(): Array<PolicyWithType> {
    return [...this.managedPolicies, ...this.customerManagedPolicies];
  }

  services: Array<Service> = [];

  constructor(db: DatabaseService, policies: Policy[], services: Service[]) {
    this._policyCollection = db.collection("policies");
    this.managedPolicies = policies.map(p => ({...p, system: true}));
    this.services = services;
  }

  // @internal
  _findAll(): Promise<Policy[]> {
    return this._policyCollection
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

  find(limit: number, skip: number = 0) {
    return {
      meta: {
        total: this.policies.length
      },
      data: this.policies.slice(skip || 0, (skip || 0) + (limit || this.policies.length))
    };
  }

  findOne(id: ObjectId): Promise<Policy | null> {
    return this._policyCollection.findOne({_id: new ObjectId(id)});
  }

  insertOne(policy: Policy): Promise<InsertOneWriteOpResult> {
    return this._policyCollection.insertOne(policy);
  }

  updateOne(id: ObjectId, policy: Policy): Promise<boolean> {
    return this._policyCollection
      .updateOne({_id: new ObjectId(id)}, {$set: policy})
      .then(r => r.result.ok == 1);
  }

  deleteOne(id: ObjectId) {
    return this._policyCollection.deleteOne({_id: new ObjectId(id)});
  }
}

type PolicyWithType = Policy & {system: boolean};
type UserManagedPolicy = Policy & {_id?: string};
