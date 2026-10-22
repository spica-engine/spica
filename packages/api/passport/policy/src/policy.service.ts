import {Inject, Injectable} from "@nestjs/common";
import {Id} from "@spica-server/interface-data";
import {Policy, POLICY_REPOSITORY, PolicyRepository} from "@spica-server/interface-passport-policy";
import managedPolicies from "./policies/index.js";

@Injectable()
export class PolicyService {
  managedPolicies: Array<PolicyWithType>;
  customerManagedPolicies: Array<PolicyWithType>;

  get policies(): Array<PolicyWithType> {
    return [...this.managedPolicies, ...this.customerManagedPolicies];
  }

  constructor(@Inject(POLICY_REPOSITORY) private readonly repository: PolicyRepository) {
    this.managedPolicies = managedPolicies.map(p => ({...p, system: true}) as PolicyWithType);
  }

  _findAll(): Promise<Policy[]> {
    return this.repository.findAll().then(policies => {
      this.customerManagedPolicies = policies.map(p => {
        const policy = {...p, system: false};
        return policy as PolicyWithType;
      });
      return this.policies;
    });
  }

  findById(id: Id) {
    return this.repository.findById(id);
  }

  insert(policy: Policy) {
    return this.repository.insert(policy);
  }

  replaceById(id: Id, policy: Policy) {
    return this.repository.replaceById(id, policy);
  }

  deleteById(id: Id) {
    return this.repository.deleteById(id);
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
